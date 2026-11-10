import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => {
	const initial = {
		schemaVersion: 1,
		activeServerId: "server-a",
		servers: [
			{ id: "server-a", name: "A", baseUrl: "https://a.example" },
			{ id: "server-b", name: "B", baseUrl: "https://b.example" },
		],
	};
	const store = { get: vi.fn(), set: vi.fn(), save: vi.fn() };
	const loadStore = vi.fn();
	const loadDatabase = vi.fn();
	const adapter = vi.fn();
	const invoke = vi.fn();
	const clearQueries = vi.fn();
	const factories = Array.from({ length: 6 }, () => vi.fn());
	return {
		initial,
		store,
		loadStore,
		loadDatabase,
		adapter,
		invoke,
		clearQueries,
		factories,
		apiUrl: "https://a.example",
		memory: initial,
		saved: initial,
		handles: [] as Array<{
			path: string;
			closed: boolean;
			close: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
			execute: ReturnType<typeof vi.fn>;
			select: ReturnType<typeof vi.fn>;
		}>,
		bundles: [] as Array<{
			persistence: unknown;
			cleanup: ReturnType<typeof vi.fn>;
			utils: { refetch: ReturnType<typeof vi.fn> };
		}>,
	};
});
vi.mock("@tauri-apps/plugin-store", () => ({
	Store: { load: fixture.loadStore },
}));
vi.mock("@tauri-apps/plugin-sql", () => ({
	default: { load: fixture.loadDatabase },
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: fixture.invoke }));
vi.mock("@tanstack/tauri-db-sqlite-persistence", () => ({
	createTauriSQLitePersistence: fixture.adapter,
}));
vi.mock("~/infrastructure/api-base", () => ({
	getBuildTimeServerUrl: () => "https://a.example",
	setApiBaseUrl: (url: string) => {
		fixture.apiUrl = url;
	},
}));
vi.mock("~/query-client", () => ({
	queryClient: { clear: fixture.clearQueries },
}));
vi.mock("~/collections/tags-collection", () => ({
	createTagsCollection: fixture.factories[0],
}));
vi.mock("~/collections/sources-collection", () => ({
	createSourcesCollection: fixture.factories[1],
}));
vi.mock("~/collections/projects-collection", () => ({
	createProjectsCollection: fixture.factories[2],
}));
vi.mock("~/collections/characters-collection", () => ({
	createCharactersCollection: fixture.factories[3],
}));
vi.mock("~/collections/ips-collection", () => ({
	createIpsCollection: fixture.factories[4],
}));
vi.mock("~/collections/authors-collection", () => ({
	createAuthorsCollection: fixture.factories[5],
}));

beforeEach(() => {
	vi.resetModules();
	vi.resetAllMocks();
	fixture.apiUrl = "https://a.example";
	fixture.memory = structuredClone(fixture.initial);
	fixture.saved = structuredClone(fixture.initial);
	fixture.handles.splice(0);
	fixture.bundles.splice(0);
	fixture.store.get.mockImplementation(async () => fixture.memory);
	fixture.store.set.mockImplementation(async (_key, value) => {
		fixture.memory = structuredClone(value);
	});
	fixture.store.save.mockImplementation(async () => {
		fixture.saved = structuredClone(fixture.memory);
	});
	fixture.loadStore.mockResolvedValue(fixture.store);
	fixture.loadDatabase.mockImplementation(async (path: string) => {
		const database = {
			path,
			closed: false,
			close: vi.fn<() => Promise<boolean>>(),
			execute: vi.fn(),
			select: vi.fn(),
		};
		database.close.mockImplementation(async () => {
			database.closed = true;
			return true;
		});
		database.execute.mockImplementation(async () => {
			if (database.closed) throw new Error("closed handle");
			return { rowsAffected: 0 };
		});
		database.select.mockImplementation(async () => {
			if (database.closed) throw new Error("closed handle");
			return [];
		});
		fixture.handles.push(database);
		return database;
	});
	fixture.adapter.mockImplementation(({ database }) => ({ database }));
	for (const factory of fixture.factories)
		factory.mockImplementation((persistence) => {
			const collection = {
				persistence,
				cleanup: vi.fn(async () => {}),
				utils: { refetch: vi.fn(async () => {}) },
			};
			fixture.bundles.push(collection);
			return collection;
		});
});

async function setup() {
	const settings = await import("./server-settings");
	const persistence = await import("../db/persistence");
	const collections = await import("~/collections");
	await settings.initializeServerSettings();
	const originalPersistence =
		await persistence.initializePersistence("server-a");
	const originalCollections = await collections.initializeCollections();
	return {
		settings,
		persistence,
		collections,
		originalPersistence,
		originalCollections,
	};
}
const edited = (name = "Updated") => ({
	id: "server-a",
	baseUrl: "https://new.example",
	name,
});

describe("server configuration transactions", () => {
	it.each([
		{ ...edited(), name: "a".repeat(101) },
		{ ...edited(), baseUrl: "not-a-url" },
		{ ...edited(), baseUrl: "https://user:secret@example.com" },
	])(
		"rejects invalid candidates before touching the running DB or store",
		async (candidate) => {
			const {
				settings,
				persistence,
				collections,
				originalPersistence,
				originalCollections,
			} = await setup();
			await expect(
				settings.updateServerConnection(candidate),
			).rejects.toThrow();
			expect(fixture.loadDatabase).toHaveBeenCalledTimes(1);
			expect(fixture.handles[0].close).not.toHaveBeenCalled();
			expect(fixture.store.set).not.toHaveBeenCalled();
			expect(persistence.getPersistence()).toBe(originalPersistence);
			expect(collections.getCollections()).toBe(originalCollections);
		},
	);

	it("keeps the original runtime if preparing the replacement DB fails", async () => {
		const { settings, persistence, originalPersistence } = await setup();
		fixture.loadDatabase.mockRejectedValueOnce(new Error("load failed"));
		await expect(settings.updateServerConnection(edited())).rejects.toThrow(
			"load failed",
		);
		expect(fixture.store.set).not.toHaveBeenCalled();
		expect(fixture.handles[0].close).not.toHaveBeenCalled();
		expect(persistence.getPersistence()).toBe(originalPersistence);
		expect(settings.getActiveServer()?.id).toBe("server-a");
	});

	it.each(["set", "save"] as const)(
		"preserves the running connection and restores store memory after %s fails",
		async (stage) => {
			const {
				settings,
				persistence,
				collections,
				originalPersistence,
				originalCollections,
			} = await setup();
			fixture.store[stage].mockRejectedValueOnce(new Error(`${stage} failed`));
			await expect(settings.updateServerConnection(edited())).rejects.toThrow(
				`${stage} failed`,
			);
			expect(fixture.handles[0].closed).toBe(false);
			expect(fixture.handles[1].closed).toBe(true);
			expect(persistence.getPersistence()).toBe(originalPersistence);
			expect(collections.getCollections()).toBe(originalCollections);
			expect(fixture.memory).toEqual(fixture.initial);
			expect(fixture.saved).toEqual(fixture.initial);
			expect(fixture.apiUrl).toBe("https://a.example");
		},
	);

	it("restores saved settings even when save rejects after writing the candidate", async () => {
		const { settings, persistence, originalPersistence } = await setup();
		fixture.store.save.mockImplementationOnce(async () => {
			fixture.saved = structuredClone(fixture.memory);
			throw new Error("save acknowledgement failed");
		});
		await expect(settings.updateServerConnection(edited())).rejects.toThrow(
			"save acknowledgement failed",
		);
		expect(fixture.saved).toEqual(fixture.initial);
		expect(persistence.getPersistence()).toBe(originalPersistence);
	});

	it("reopens the original handle behind the same facade if close rejects after closing it", async () => {
		const {
			settings,
			persistence,
			collections,
			originalPersistence,
			originalCollections,
		} = await setup();
		fixture.handles[0].close.mockImplementationOnce(async () => {
			fixture.handles[0].closed = true;
			throw new Error("close acknowledgement failed");
		});
		await expect(settings.updateServerConnection(edited())).rejects.toThrow(
			"close acknowledgement failed",
		);
		expect(fixture.handles).toHaveLength(3);
		expect(fixture.handles[1].closed).toBe(true);
		expect(fixture.handles[2].path).toBe(fixture.handles[0].path);
		expect(persistence.getPersistence()).toBe(originalPersistence);
		expect(collections.getCollections()).toBe(originalCollections);
		await expect(
			fixture.adapter.mock.calls[0][0].database.execute("SELECT 1"),
		).resolves.toEqual({ rowsAffected: 0 });
		expect(fixture.handles[2].execute).toHaveBeenCalledWith(
			"SELECT 1",
			undefined,
		);
		expect(settings.getActiveServer()?.id).toBe("server-a");
		expect(fixture.saved).toEqual(fixture.initial);
	});

	it("commits the new runtime before best-effort cache deletion and rebuilds collections", async () => {
		const {
			settings,
			persistence,
			collections,
			originalPersistence,
			originalCollections,
		} = await setup();
		fixture.invoke.mockRejectedValueOnce(new Error("cache deletion failed"));
		const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const updated = await settings.updateServerConnection(edited());
			expect(updated.id).not.toBe("server-a");
			expect(persistence.getPersistenceServerId()).toBe(updated.id);
			expect(settings.getActiveServer()).toEqual(updated);
			expect(fixture.saved.activeServerId).toBe(updated.id);
			expect(fixture.apiUrl).toBe("https://new.example");
			expect(persistence.getPersistence()).not.toBe(originalPersistence);
			expect(fixture.handles[0].closed).toBe(true);
			expect(() => collections.getCollections()).toThrow("not initialized");
			expect(
				fixture.bundles.every(
					(collection) => collection.cleanup.mock.calls.length === 1,
				),
			).toBe(true);
			await expect(
				fixture.adapter.mock.calls[0][0].database.execute("SELECT 1"),
			).rejects.toThrow("closed");
			const rebuilt = await collections.initializeCollections();
			expect(rebuilt).not.toBe(originalCollections);
			expect(
				fixture.bundles
					.slice(6)
					.every(
						(collection) =>
							collection.persistence === persistence.getPersistence(),
					),
			).toBe(true);
			expect(fixture.clearQueries).toHaveBeenCalledOnce();
			expect(warning).toHaveBeenCalled();
		} finally {
			warning.mockRestore();
		}
	});

	it("preserves cache and runtime identity for a name-only change", async () => {
		const {
			settings,
			persistence,
			collections,
			originalPersistence,
			originalCollections,
		} = await setup();
		await settings.updateServerConnection({
			id: "server-a",
			name: "Renamed",
			baseUrl: "https://a.example/",
		});
		expect(persistence.getPersistence()).toBe(originalPersistence);
		expect(collections.getCollections()).toBe(originalCollections);
		expect(fixture.loadDatabase).toHaveBeenCalledTimes(1);
		expect(fixture.invoke).not.toHaveBeenCalled();
	});

	it("waits for saved settings before closing the original DB or publishing the replacement", async () => {
		const { settings, persistence, originalPersistence } = await setup();
		const saving = Promise.withResolvers<void>();
		fixture.store.save.mockReturnValueOnce(saving.promise);
		const updating = settings.updateServerConnection(edited());
		await vi.waitFor(() => expect(fixture.store.save).toHaveBeenCalled());
		expect(fixture.handles[0].close).not.toHaveBeenCalled();
		expect(persistence.getPersistence()).toBe(originalPersistence);
		expect(settings.getActiveServer()?.id).toBe("server-a");
		expect(fixture.apiUrl).toBe("https://a.example");
		saving.resolve();
		await updating;
		expect(persistence.getPersistence()).not.toBe(originalPersistence);
	});

	it("coordinates selection and removal with the running cache identity", async () => {
		const { settings, persistence, collections } = await setup();
		await settings.activateServer("server-b");
		expect(persistence.getPersistenceServerId()).toBe("server-b");
		expect(fixture.apiUrl).toBe("https://b.example");
		await collections.initializeCollections();
		await settings.removeServerConnection("server-b");
		expect(persistence.getPersistenceServerId()).toBe("server-a");
		expect(fixture.apiUrl).toBe("https://a.example");
		await settings.removeServerConnection("server-a");
		expect(settings.getActiveServer()).toBeNull();
		expect(() => persistence.getPersistence()).toThrow("not initialized");
	});

	it("does not lose another settings mutation while a save is pending", async () => {
		const { settings } = await setup();
		const saving = Promise.withResolvers<void>();
		fixture.store.save.mockReturnValueOnce(saving.promise);
		const first = settings.addServerConnection({
			name: "C",
			baseUrl: "https://c.example",
		});
		const second = settings.addServerConnection({
			name: "D",
			baseUrl: "https://d.example",
		});
		await vi.waitFor(() => expect(fixture.store.save).toHaveBeenCalled());
		saving.resolve();
		await Promise.all([first, second]);
		expect(
			settings.getServerSettings().servers.map((server) => server.name),
		).toEqual(["A", "B", "C", "D"]);
	});
});

describe("persistence and collection generations", () => {
	it("coalesces initialization and rejects silently reusing another server's DB", async () => {
		const { persistence, originalPersistence } = await setup();
		const [a, b] = await Promise.all([
			persistence.initializePersistence("server-a"),
			persistence.initializePersistence("server-a"),
		]);
		expect(a).toBe(originalPersistence);
		expect(b).toBe(a);
		await expect(persistence.initializePersistence("server-b")).rejects.toThrow(
			"changing servers",
		);
		expect(fixture.loadDatabase).toHaveBeenCalledTimes(1);
	});

	it("rebuilds rather than reusing collections after persistence is closed and reopened", async () => {
		const { persistence, collections, originalCollections } = await setup();
		await persistence.closePersistence();
		const rebuilt = await collections.initializeCollections();
		expect(rebuilt).not.toBe(originalCollections);
		expect(collections.getCollections()).toBe(rebuilt);
		expect(fixture.loadDatabase).toHaveBeenCalledTimes(2);
		expect(
			fixture.bundles
				.slice(0, 6)
				.every((collection) => collection.cleanup.mock.calls.length === 1),
		).toBe(true);
	});

	it("prevents an old in-flight collection initialization from replacing the new bundle", async () => {
		const settings = await import("./server-settings");
		const persistence = await import("../db/persistence");
		const collections = await import("~/collections");
		await settings.initializeServerSettings();
		await persistence.initializePersistence("server-a");
		const refetch = Promise.withResolvers<void>();
		fixture.factories[0].mockImplementationOnce((persistence) => {
			const collection = {
				persistence,
				cleanup: vi.fn(async () => {}),
				utils: { refetch: vi.fn(() => refetch.promise) },
			};
			fixture.bundles.push(collection);
			return collection;
		});
		const stale = collections.initializeCollections();
		const staleResult = expect(stale).rejects.toThrow("superseded");
		await vi.waitFor(() => expect(fixture.bundles).toHaveLength(1));
		await settings.activateServer("server-b");
		const current = await collections.initializeCollections();
		refetch.resolve();
		await staleResult;
		expect(collections.getCollections()).toBe(current);
		expect(fixture.bundles[0].cleanup).toHaveBeenCalledOnce();
	});
});
