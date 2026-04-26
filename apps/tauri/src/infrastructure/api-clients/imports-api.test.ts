import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const {
	mockCreateMany,
	mockFindPendingImportRequests,
	mockFindImportRequestsByIds,
	mockMarkImportRequestsCompleted,
	mockDeleteImportRequests,
	mockFindMediaSourceForFile,
	mockRestoreSource,
	mockFetchMediaSource,
	mockSyncMediaSources,
	mockEmit,
	mockGetTauriAppServices,
} = vi.hoisted(() => ({
	mockCreateMany: vi.fn<(jobs: unknown[]) => Promise<unknown[]>>(async () => []),
	mockFindPendingImportRequests: vi.fn<() => Promise<unknown[]>>(async () => []),
	mockFindImportRequestsByIds: vi.fn<() => Promise<unknown[]>>(async () => []),
	mockMarkImportRequestsCompleted: vi.fn(async () => undefined),
	mockDeleteImportRequests: vi.fn(async () => undefined),
	mockFindMediaSourceForFile: vi.fn(async () => null),
	mockRestoreSource: vi.fn(async () => ({
		processed: 0,
		skipped: 0,
		errors: [],
	})),
	mockFetchMediaSource: vi.fn(),
	mockSyncMediaSources: vi.fn(async () => ({ results: [] })),
	mockEmit: vi.fn(async () => undefined),
	mockGetTauriAppServices: vi.fn(),
}));

vi.mock("~/infrastructure/local-api/repositories/media-repository", () => ({
	TauriMediaRepository: {
		batchUpsert: vi.fn(async () => [{ id: "media-1", filePath: "image.png" }]),
		findByPath: vi.fn(async () => null),
	},
}));

vi.mock("~/infrastructure/local-api/repositories/tauri-job-repository", () => ({
	TauriJobRepository: {
		createMany: mockCreateMany,
		findPendingImportRequests: mockFindPendingImportRequests,
		findImportRequestsByIds: mockFindImportRequestsByIds,
		markImportRequestsCompleted: mockMarkImportRequestsCompleted,
		deleteImportRequests: mockDeleteImportRequests,
	},
}));

vi.mock("~/infrastructure/local-api/services/source-backup-service", () => ({
	TauriSourceBackupService: {
		findMediaSourceForFile: mockFindMediaSourceForFile,
		restoreSource: mockRestoreSource,
	},
}));

vi.mock("./sources-api", () => ({
	fetchMediaSource: mockFetchMediaSource,
	syncMediaSources: mockSyncMediaSources,
}));

vi.mock("@tauri-apps/api/event", () => ({
	emit: mockEmit,
}));

vi.mock("~/app-services", () => ({
	getTauriAppServices: mockGetTauriAppServices,
}));

const importsApi = await import("./imports-api");

describe("tauri imports api", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		Object.defineProperty(globalThis, "localStorage", {
			configurable: true,
			get() {
				throw new Error("localStorage should not be accessed");
			},
		});
		mockGetTauriAppServices.mockReturnValue({
			fileSystem: {
				exists: vi.fn(async () => false),
				mkdir: vi.fn(async () => undefined),
				writeFile: vi.fn(async () => undefined),
				stat: vi.fn(async () => ({
					size: 3,
					mtime: new Date().toISOString(),
					birthtime: new Date().toISOString(),
					isDirectory: false,
				})),
			},
			commandClient: {
				invoke: vi.fn(async () => undefined),
			},
		});
	});

	afterEach(() => {
		delete (globalThis as { localStorage?: unknown }).localStorage;
		vi.unstubAllGlobals();
	});

	it("stores pending imports in jobs without touching localStorage", async () => {
		await importsApi.bulkAddImportItems([
			{
				description: "queued",
				sourceUrls: ["https://example.com/image.png"],
			},
		]);

		expect(mockCreateMany).toHaveBeenCalledWith([
			expect.objectContaining({
				type: "import_request",
				status: "pending",
				payload: expect.objectContaining({
					targetUrl: "https://example.com/image.png",
				}),
			}),
		]);
		expect(mockEmit).toHaveBeenCalledWith("import-request:created", {
			count: 1,
		});
	});

	it("lists pending imports from the jobs repository", async () => {
		mockFindPendingImportRequests.mockResolvedValueOnce([
			{
				id: "job-1",
				type: "import_request",
				mediaSourceId: null,
				status: "pending",
				payload: {
					targetUrl: "https://example.com/image.png",
				},
				result: null,
				error: null,
				createdAt: new Date("2026-04-25T00:00:00.000Z"),
				updatedAt: new Date("2026-04-25T00:00:00.000Z"),
				parentId: null,
			},
		]);

		await expect(importsApi.listPendingImports()).resolves.toEqual([
			expect.objectContaining({
				id: "job-1",
				item: expect.objectContaining({
					targetUrl: "https://example.com/image.png",
				}),
			}),
		]);
	});

	it("downloads files, syncs sources, and completes jobs during processing", async () => {
		mockFindImportRequestsByIds.mockResolvedValueOnce([
			{
				id: "job-1",
				type: "import_request",
				mediaSourceId: null,
				status: "pending",
				payload: {
					targetUrl: "https://example.com/image.png",
					fileName: "image.png",
				},
				result: null,
				error: null,
				createdAt: new Date("2026-04-25T00:00:00.000Z"),
				updatedAt: new Date("2026-04-25T00:00:00.000Z"),
				parentId: null,
			},
		]);
		mockFetchMediaSource.mockResolvedValueOnce({
			id: "source-1",
			name: "Default",
			description: null,
			type: "local",
			connectionInfo: { path: "/library" },
		});
		const mkdir = vi.fn(async () => undefined);
		const invoke = vi.fn(async () => undefined);
		mockGetTauriAppServices.mockReturnValue({
			fileSystem: {
				exists: vi.fn(async () => false),
				mkdir,
				writeFile: vi.fn(async () => undefined),
				stat: vi.fn(async () => ({
					size: 3,
					mtime: new Date().toISOString(),
					birthtime: new Date().toISOString(),
					isDirectory: false,
				})),
			},
			commandClient: { invoke },
		});

		const result = await importsApi.processPendingImports(["job-1"], "source-1");

		expect(result).toEqual({ success: true, processedCount: 1 });
		expect(mkdir).toHaveBeenCalled();
		expect(invoke).toHaveBeenCalledWith("download_file", {
			url: "https://example.com/image.png",
			destPath: expect.stringContaining("image.png"),
		});
		expect(mockSyncMediaSources).toHaveBeenCalledWith(["source-1"]);
		expect(mockMarkImportRequestsCompleted).toHaveBeenCalledWith(["job-1"]);
		expect(mockEmit).toHaveBeenCalledWith("import-request:processed", {
			processedCount: 1,
		});
	});
});
