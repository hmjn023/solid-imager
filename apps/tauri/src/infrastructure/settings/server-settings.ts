import { Store } from "@tauri-apps/plugin-store";
import { z } from "zod";
import { getBuildTimeApiBaseUrl } from "~/infrastructure/api-base";

const SETTINGS_FILE = "settings.json";
const SETTINGS_KEY = "serverSettings";
const SETTINGS_VERSION = 1;

const serverConnectionSchema = z.object({
	id: z.string().trim().min(1),
	name: z.string().trim().min(1).max(100),
	baseUrl: z
		.string()
		.trim()
		.url()
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

export type ServerConnection = z.infer<typeof serverConnectionSchema>;
export type ServerSettings = z.infer<typeof serverSettingsSchema>;

let settings: ServerSettings | null = null;
let storePromise: Promise<Store> | null = null;

function createId(): string {
	return crypto.randomUUID();
}

function createInitialSettings(): ServerSettings {
	const baseUrl = normalizeUrl(getBuildTimeApiBaseUrl());
	const server: ServerConnection = {
		baseUrl,
		id: "default",
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
	return settings;
}

export function getServerSettings(): ServerSettings {
	if (!settings) {
		throw new Error(
			"Server settings are not initialized. Call initializeServerSettings() first.",
		);
	}
	return settings;
}

export function getActiveServer(): ServerConnection | null {
	const current = getServerSettings();
	return (
		current.servers.find((server) => server.id === current.activeServerId) ??
		null
	);
}

export async function saveServerSettings(
	next: ServerSettings,
): Promise<ServerSettings> {
	const normalized = normalizeSettings({
		...next,
		schemaVersion: SETTINGS_VERSION,
	});
	const store = await getStore();
	await store.set(SETTINGS_KEY, normalized);
	await store.save();
	settings = normalized;
	return normalized;
}

export async function addServerConnection(input: {
	baseUrl: string;
	name: string;
}): Promise<ServerConnection> {
	const current = getServerSettings();
	const server = serverConnectionSchema.parse({
		baseUrl: normalizeUrl(input.baseUrl),
		id: createId(),
		name: input.name.trim(),
	});
	await saveServerSettings({
		...current,
		activeServerId: current.activeServerId ?? server.id,
		servers: [...current.servers, server],
	});
	return server;
}

export async function removeServerConnection(id: string): Promise<void> {
	const current = getServerSettings();
	const servers = current.servers.filter((server) => server.id !== id);
	await saveServerSettings({
		...current,
		activeServerId:
			current.activeServerId === id
				? (servers[0]?.id ?? null)
				: current.activeServerId,
		servers,
	});
}

export async function updateServerConnection(
	server: ServerConnection,
): Promise<void> {
	const current = getServerSettings();
	await saveServerSettings({
		...current,
		servers: current.servers.map((item) =>
			item.id === server.id
				? serverConnectionSchema.parse({
						...server,
						baseUrl: normalizeUrl(server.baseUrl),
						name: server.name.trim(),
					})
				: item,
		),
	});
}

export async function activateServer(id: string): Promise<ServerConnection> {
	const current = getServerSettings();
	const server = current.servers.find((item) => item.id === id);
	if (!server) {
		throw new Error("The selected server does not exist.");
	}
	await saveServerSettings({ ...current, activeServerId: id });
	return server;
}
