import { SCALAR_DOCS_PATH } from "@solid-imager/core/http";
import { Store } from "@tauri-apps/plugin-store";
import { z } from "zod";
import { getBuildTimeServerUrl } from "~/infrastructure/api-base";
import { removeDatabaseFile } from "~/infrastructure/db/database-files";
import {
	getPersistenceServerId,
	replacePersistence,
} from "~/infrastructure/db/persistence";
import { setApiBaseUrl } from "~/infrastructure/api-base";

const SETTINGS_FILE = "settings.json";
const SETTINGS_KEY = "serverSettings";
const SETTINGS_VERSION = 1;

const serverConnectionSchema = z.object({
	id: z.string().trim().min(1),
	name: z.string().trim().min(1).max(100),
	baseUrl: z
		.string()
		.trim()
		.pipe(z.url())
		.refine(
			(value) => {
				const parsed = new URL(value);
				return (
					(parsed.protocol === "http:" || parsed.protocol === "https:") &&
					!parsed.username &&
					!parsed.password
				);
			},
			{
				message:
					"Server URL must use http or https without embedded credentials.",
			},
		),
});

const serverSettingsSchema = z.object({
	schemaVersion: z.literal(SETTINGS_VERSION),
	activeServerId: z.string().trim().min(1).nullable(),
	servers: z.array(serverConnectionSchema),
});

/** A named server profile with a normalized HTTP(S) URL and stable cache identity. */
export type ServerConnection = z.infer<typeof serverConnectionSchema>;
/** Persisted server profiles and the selected profile, if any. */
export type ServerSettings = z.infer<typeof serverSettingsSchema>;

let settings: ServerSettings | null = null;
let storePromise: Promise<Store> | null = null;
let mutation: Promise<void> = Promise.resolve();
function serializeMutation<T>(action: () => Promise<T>): Promise<T> {
	const pending = mutation.then(action, action);
	mutation = pending.then(
		() => {},
		() => {},
	);
	return pending;
}

function createId(): string {
	return crypto.randomUUID();
}

function createBuildTimeServerId(baseUrl: string): string {
	let hash = 14_695_981_039_346_656_037n;
	for (const character of baseUrl) {
		hash = BigInt.asUintN(
			64,
			(hash ^ BigInt(character.codePointAt(0) ?? 0)) * 1_099_511_628_211n,
		);
	}
	return `buildtime-${hash.toString(16)}`;
}

function createInitialSettings(): ServerSettings {
	const baseUrl = normalizeUrl(getBuildTimeServerUrl());
	const server: ServerConnection = {
		baseUrl,
		id: createBuildTimeServerId(baseUrl),
		name: "Default server",
	};
	return {
		activeServerId: server.id,
		schemaVersion: SETTINGS_VERSION,
		servers: [server],
	};
}

function normalizeUrl(value: string): string {
	const parsed = new URL(value.trim());
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error("Server URL must use http or https.");
	}
	if (parsed.username || parsed.password) {
		throw new Error("Credentials must not be embedded in the server URL.");
	}
	parsed.hash = "";
	parsed.search = "";
	parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
	return parsed.toString().replace(/\/$/, "");
}

function normalizeSettings(value: ServerSettings): ServerSettings {
	const seenIds = new Set<string>();
	const servers = value.servers.reduce<ServerConnection[]>((result, server) => {
		if (seenIds.has(server.id)) {
			return result;
		}
		seenIds.add(server.id);
		result.push({
			baseUrl: normalizeUrl(server.baseUrl),
			id: server.id,
			name: server.name.trim(),
		});
		return result;
	}, []);
	const activeServerId =
		value.activeServerId &&
		servers.some((server) => server.id === value.activeServerId)
			? value.activeServerId
			: null;
	return {
		activeServerId,
		schemaVersion: SETTINGS_VERSION,
		servers,
	};
}

async function getStore(): Promise<Store> {
	if (!storePromise) {
		storePromise = Store.load(SETTINGS_FILE);
	}
	return storePromise;
}

/**
 * Loads settings once, replacing missing or invalid persisted data with the build-time default.
 *
 * @returns The cached or newly initialized settings.
 * @throws If loading or saving the Tauri store fails.
 */
export async function initializeServerSettings(): Promise<ServerSettings> {
	if (settings) {
		return settings;
	}

	const store = await getStore();
	const stored = await store.get<unknown>(SETTINGS_KEY);
	const parsed = serverSettingsSchema.safeParse(stored);
	let shouldPersist = !parsed.success;
	if (parsed.success) {
		try {
			settings = normalizeSettings(parsed.data);
		} catch {
			settings = createInitialSettings();
			shouldPersist = true;
		}
	} else {
		settings = createInitialSettings();
	}

	if (shouldPersist) {
		await store.set(SETTINGS_KEY, settings);
		await store.save();
	}
	if (!settings) {
		throw new Error("Server settings initialization did not produce settings.");
	}
	return settings;
}

/**
 * Returns the in-memory settings.
 *
 * @throws If initializeServerSettings has not completed.
 */
export function getServerSettings(): ServerSettings {
	if (!settings) {
		throw new Error(
			"Server settings are not initialized. Call initializeServerSettings() first.",
		);
	}
	return settings;
}

/** Returns the selected profile, or null when no profile is selected. */
export function getActiveServer(): ServerConnection | null {
	const current = getServerSettings();
	return (
		current.servers.find((server) => server.id === current.activeServerId) ??
		null
	);
}

/** Returns the selected server’s documentation URL, even when RPC uses the Vite proxy. */
export function getApiDocsUrl(): string | undefined {
	const server = getActiveServer();
	return server
		? server.baseUrl.replace(/\/api\/rpc$/, "") + SCALAR_DOCS_PATH
		: undefined;
}

/** Fully validates candidates before opening, closing, deleting or saving anything. */
function validateSettings(value: ServerSettings): ServerSettings {
	return normalizeSettings(serverSettingsSchema.parse(value));
}

async function commitSettings(next: ServerSettings): Promise<ServerSettings> {
	const normalized = validateSettings(next);
	const previous = getServerSettings();
	for (const server of normalized.servers) {
		const existing = previous.servers.find((item) => item.id === server.id);
		if (existing && existing.baseUrl !== server.baseUrl)
			throw new Error(
				"A changed server URL requires a new cache identity. Use updateServerConnection().",
			);
	}
	const oldServer = previous.servers.find(
		(server) => server.id === previous.activeServerId,
	);
	const nextServer = normalized.servers.find(
		(server) => server.id === normalized.activeServerId,
	);
	const changedConnection =
		oldServer?.id !== nextServer?.id ||
		oldServer?.baseUrl !== nextServer?.baseUrl;
	const hadRuntime = getPersistenceServerId() !== undefined;
	const store = await getStore();
	let touchedStore = false;
	const persist = async () => {
		touchedStore = true;
		await store.set(SETTINGS_KEY, normalized);
		await store.save();
	};
	const reset =
		changedConnection && hadRuntime
			? (await import("~/collections")).resetCollections
			: null;
	let cleanup: Promise<void> = Promise.resolve();
	const publish = () => {
		settings = normalized;
		if (nextServer) setApiBaseUrl(nextServer.baseUrl);
		// Invalidation is synchronous up to the first await, in the same turn as
		// publishing the new DB/RPC target. Disposal completes before returning.
		cleanup = reset?.() ?? Promise.resolve();
	};
	try {
		if (changedConnection && hadRuntime)
			await replacePersistence(nextServer?.id ?? null, persist, publish);
		else {
			await persist();
			publish();
		}
	} catch (error) {
		if (touchedStore) {
			try {
				await store.set(SETTINGS_KEY, previous);
				await store.save();
			} catch (rollbackError) {
				throw new AggregateError(
					[error, rollbackError],
					"Failed to save server settings and restore the previous saved settings.",
				);
			}
		}
		throw error;
	}
	await cleanup;

	return normalized;
}

/** Serializes settings commits and connection changes against the latest configuration. */
export function saveServerSettings(
	next: ServerSettings,
): Promise<ServerSettings> {
	return serializeMutation(() => commitSettings(next));
}

async function cleanOldCache(id: string): Promise<void> {
	try {
		await removeDatabaseFile(id);
	} catch (error) {
		// Configuration and runtime already committed. A disposable cache must not
		// turn a successful connection switch into a misleading save failure.
		console.warn("Failed to remove an unused server cache", error);
	}
}

/** Adds a fully validated profile, selecting it if no server is active. */
export function addServerConnection(input: {
	baseUrl: string;
	name: string;
}): Promise<ServerConnection> {
	return serializeMutation(async () => {
		const current = getServerSettings();
		const server = serverConnectionSchema.parse({
			baseUrl: normalizeUrl(input.baseUrl),
			id: createId(),
			name: input.name.trim(),
		});
		await commitSettings({
			...current,
			activeServerId: current.activeServerId ?? server.id,
			servers: [...current.servers, server],
		});
		return server;
	});
}

/** Removes a profile; its disposable cache is deleted only after configuration commits. */
export function removeServerConnection(id: string): Promise<void> {
	return serializeMutation(async () => {
		const current = getServerSettings();
		if (!current.servers.some((server) => server.id === id)) return;
		const servers = current.servers.filter((server) => server.id !== id);
		await commitSettings({
			...current,
			activeServerId:
				current.activeServerId === id
					? (servers[0]?.id ?? null)
					: current.activeServerId,
			servers,
		});
		await cleanOldCache(id);
	});
}

/** Changes cache identity on URL edits; name-only edits retain the open connection. */
export function updateServerConnection(
	server: ServerConnection,
): Promise<ServerConnection> {
	return serializeMutation(async () => {
		const current = getServerSettings();
		const existing = current.servers.find((item) => item.id === server.id);
		if (!existing) throw new Error("The selected server does not exist.");
		const baseUrl = normalizeUrl(server.baseUrl);
		const urlChanged = existing.baseUrl !== baseUrl;
		const updated = serverConnectionSchema.parse({
			...server,
			id: urlChanged ? createId() : existing.id,
			baseUrl,
			name: server.name.trim(),
		});
		await commitSettings({
			...current,
			activeServerId:
				current.activeServerId === existing.id
					? updated.id
					: current.activeServerId,
			servers: current.servers.map((item) =>
				item.id === existing.id ? updated : item,
			),
		});
		if (urlChanged) await cleanOldCache(existing.id);
		return updated;
	});
}

/** Selects a server and coordinates its running persistence and API target. */
export function activateServer(id: string): Promise<ServerConnection> {
	return serializeMutation(async () => {
		const current = getServerSettings();
		const server = current.servers.find((item) => item.id === id);
		if (!server) throw new Error("The selected server does not exist.");
		await commitSettings({ ...current, activeServerId: id });
		return server;
	});
}
