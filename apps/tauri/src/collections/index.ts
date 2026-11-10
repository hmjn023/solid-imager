import {
	getPersistence,
	initializePersistence,
} from "~/infrastructure/db/persistence";
import { queryClient } from "~/query-client";
import { getActiveServer } from "~/infrastructure/settings/server-settings";
import { createAuthorsCollection } from "./authors-collection";
import { createCharactersCollection } from "./characters-collection";
import { createIpsCollection } from "./ips-collection";
import { createProjectsCollection } from "./projects-collection";
import { createSourcesCollection } from "./sources-collection";
import { createTagsCollection } from "./tags-collection";

/** Collections backed by the active server’s SQLite persistence. */
export type AppCollections = {
	tags: ReturnType<typeof createTagsCollection>;
	sources: ReturnType<typeof createSourcesCollection>;
	projects: ReturnType<typeof createProjectsCollection>;
	characters: ReturnType<typeof createCharactersCollection>;
	ips: ReturnType<typeof createIpsCollection>;
	authors: ReturnType<typeof createAuthorsCollection>;
};

/** Invokes a collection’s refetch utility, rejecting objects that do not expose it. */
export async function refetchCollection(collection: unknown): Promise<void> {
	if (typeof collection !== "object" || collection === null) {
		throw new Error("Expected a TanStack DB collection");
	}
	const utils: unknown = Reflect.get(collection, "utils");
	if (typeof utils !== "object" || utils === null) {
		throw new Error("Collection does not expose utilities");
	}
	const refetch: unknown = Reflect.get(utils, "refetch");
	if (typeof refetch !== "function") {
		throw new Error("Collection does not expose refetch");
	}
	const result: unknown = Reflect.apply(refetch, utils, []);
	await result;
}

let collections: AppCollections | null = null;
let boundPersistence: ReturnType<typeof getPersistence> | null = null;
let initializing: Promise<AppCollections> | null = null;
let generation = 0;
let retiring: Promise<void> | null = null;
const ownedCollections = new Set<{ cleanup: () => Promise<void> }>();

/** Disposes subscriptions and invalidates both finished and in-flight collection generations. */
export function resetCollections(): Promise<void> {
	generation++;
	collections = null;
	boundPersistence = null;
	initializing = null;
	if (retiring) return retiring;
	const retired = [...ownedCollections];
	ownedCollections.clear();
	try {
		queryClient.clear();
	} catch (error) {
		console.error("Failed to clear the retired query cache", error);
	}
	const pending = (async () => {
		const results = await Promise.allSettled(
			retired.map((collection) =>
				Promise.resolve().then(() => collection.cleanup()),
			),
		);
		for (const result of results) {
			if (result.status === "rejected")
				console.error("Failed to clean up a retired collection", result.reason);
		}
	})();
	retiring = pending;
	void pending
		.finally(() => {
			if (retiring === pending) retiring = null;
		})
		.catch(() => {});
	return pending;
}

/** Initializes one generation of collections against the currently open server connection. */
export function initializeCollections(): Promise<AppCollections> {
	if (retiring) return retiring.then(() => initializeCollections());
	if (collections) {
		try {
			if (boundPersistence === getPersistence())
				return Promise.resolve(collections);
		} catch {
			/* A closed connection must be initialized again below. */
		}
		return resetCollections().then(() => initializeCollections());
	}
	if (initializing) return initializing;
	const currentGeneration = generation;
	const pending = (async () => {
		const persistence = await initializePersistence(getActiveServer()?.id);
		const assertCurrent = () => {
			if (currentGeneration !== generation || persistence !== getPersistence())
				throw new Error(
					"Collection initialization was superseded by a server switch.",
				);
		};
		assertCurrent();
		// Initialize persistence tables through the first collection before creating the rest.
		const tags = createTagsCollection(persistence);
		ownedCollections.add(tags);
		try {
			await refetchCollection(tags);
		} catch (error) {
			console.error("Failed to perform initial refetch for tags:", error);
		}
		assertCurrent();
		const sources = createSourcesCollection(persistence);
		const projects = createProjectsCollection(persistence);
		const characters = createCharactersCollection(persistence);
		const ips = createIpsCollection(persistence);
		const authors = createAuthorsCollection(persistence);
		collections = { tags, sources, projects, characters, ips, authors };
		for (const collection of Object.values(collections))
			ownedCollections.add(collection);
		boundPersistence = persistence;
		return collections;
	})();
	initializing = pending;
	void pending
		.finally(() => {
			if (initializing === pending) initializing = null;
		})
		.catch(() => {});
	return pending;
}

/** Returns collections only while they belong to the currently open persistence instance. */
export function getCollections(): AppCollections {
	if (!collections || boundPersistence !== getPersistence())
		throw new Error(
			"Collections not initialized for this connection. Call initializeCollections() first.",
		);
	return collections;
}
