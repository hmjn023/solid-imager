import { initializePersistence } from "~/infrastructure/db/persistence";
import { createTagsCollection } from "./tags-collection";
import { createSourcesCollection } from "./sources-collection";
import { createProjectsCollection } from "./projects-collection";
import { createCharactersCollection } from "./characters-collection";
import { createIpsCollection } from "./ips-collection";
import { createAuthorsCollection } from "./authors-collection";

export type AppCollections = {
	tags: ReturnType<typeof createTagsCollection>;
	sources: ReturnType<typeof createSourcesCollection>;
	projects: ReturnType<typeof createProjectsCollection>;
	characters: ReturnType<typeof createCharactersCollection>;
	ips: ReturnType<typeof createIpsCollection>;
	authors: ReturnType<typeof createAuthorsCollection>;
};

let collections: AppCollections | null = null;

export async function initializeCollections() {
	if (collections) {
		return collections;
	}

	const persistence = await initializePersistence();

	// TanStack DB の ensureInitialized() が並行呼び出しに未対応なため、
	// 最初のコレクションを1つ作成して refetch で内部テーブルを初期化してから、
	// 残りのコレクションを順次作成する。
	const tags = createTagsCollection(persistence);
	try {
		await tags.utils.refetch();
	} catch (error) {
		console.error("Failed to perform initial refetch for tags:", error);
	}

	const sources = createSourcesCollection(persistence);
	const projects = createProjectsCollection(persistence);
	const characters = createCharactersCollection(persistence);
	const ips = createIpsCollection(persistence);
	const authors = createAuthorsCollection(persistence);

	collections = { tags, sources, projects, characters, ips, authors };
	return collections;
}

export function getCollections() {
	if (!collections) {
		throw new Error(
			"Collections not initialized. Call initializeCollections() first.",
		);
	}
	return collections;
}
