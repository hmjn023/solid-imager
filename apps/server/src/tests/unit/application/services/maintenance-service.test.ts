import fs from "node:fs/promises";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vite-plus/test";
import { MaintenanceService } from "~/application/services/maintenance-service";

// ---- Module mocks ----

// Mock node:fs/promises to control thumbnail directory reads and lanceDb manifest reads
vi.mock("node:fs/promises", () => ({
	default: {
		readdir: vi.fn(),
		readFile: vi.fn(),
	},
}));

// Mock getSourceCacheDir to return a predictable path
vi.mock("~/infrastructure/jobs/thumbnails", () => ({
	getSourceCacheDir: vi.fn((sourceId: string) => `/cache/${sourceId}`),
}));

// Mock registry for configuration loading
vi.mock("~/application/registry", () => ({
	services: {
		getConfigService: () => ({
			getConfig: () => ({
				lancedb: {
					cacheDir: ".cache/lancedb-cache",
				},
			}),
		}),
	},
}));

// Mock lancedb-dump-service
const mockReadMediaIds = vi.fn();
vi.mock("~/application/services/lancedb-dump-service", () => ({
	readMediaIds: mockReadMediaIds,
}));

// Mock backup-service
const mockQueueSourceLanceDBDelta = vi.fn();
vi.mock("~/application/services/backup-service", () => ({
	BackupService: {
		queueSourceLanceDBDelta: mockQueueSourceLanceDBDelta,
	},
}));

// Silence logger output during tests
vi.mock("~/infrastructure/logger", () => ({
	logger: {
		info: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

// ---- Repository mocks ----

const mockMediaRepo = {
	findIdsWithMissingGenerationInfo: vi.fn(),
	findAllMediaIndices: vi.fn(),
	findAllPathsBySourceId: vi.fn(),
};

const mockJobRepo = {
	createIfUnique: vi.fn(),
};

const mockSourceRepo = {
	findById: vi.fn(),
	findAll: vi.fn(),
};

// ---- Helpers ----

/** Build a minimal media index record for test data. */
function makeMedia(
	id: string,
	mediaSourceId = "source-1",
	filePath = `/media/${id}.png`,
) {
	return { id, mediaSourceId, filePath };
}

/** Build a minimal local media source record for test data. */
function makeLocalSource(id: string, path: string) {
	return { id, type: "local", connectionInfo: { path } };
}

// ---- Test suite ----

describe("MaintenanceService", () => {
	let service: MaintenanceService;

	beforeEach(() => {
		service = new MaintenanceService(
			mockMediaRepo as any,
			mockJobRepo as any,
			mockSourceRepo as any,
		);
		mockSourceRepo.findAll.mockResolvedValue([]);
		mockMediaRepo.findAllPathsBySourceId.mockResolvedValue([]);
	});

	afterEach(() => {
		vi.clearAllMocks();
		mockReadMediaIds.mockReset();
		mockQueueSourceLanceDBDelta.mockReset();
	});

	// --------------------------------------------------------------------------
	// performStartupChecks
	// --------------------------------------------------------------------------

	describe("performStartupChecks", () => {
		it("should run both queueMissingMetadata and queueMissingThumbnails without throwing", async () => {
			// When there is nothing missing, neither method should throw.
			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			mockMediaRepo.findAllMediaIndices.mockResolvedValue([]);

			await expect(service.performStartupChecks()).resolves.toBeUndefined();

			expect(
				mockMediaRepo.findIdsWithMissingGenerationInfo,
			).toHaveBeenCalledOnce();
			expect(mockMediaRepo.findAllMediaIndices).toHaveBeenCalledOnce();
		});
	});

	// --------------------------------------------------------------------------
	// queueMissingMetadata (exercised via performStartupChecks)
	// --------------------------------------------------------------------------

	describe("queueMissingMetadata", () => {
		it("should NOT create any jobs when there are no media with missing generation info", async () => {
			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			mockMediaRepo.findAllMediaIndices.mockResolvedValue([]);

			await service.performStartupChecks();

			expect(mockJobRepo.createIfUnique).not.toHaveBeenCalled();
		});

		it("should create a job for each media that is missing generation info", async () => {
			const media1 = makeMedia("media-1");
			const media2 = makeMedia("media-2");

			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([
				media1,
				media2,
			]);
			mockMediaRepo.findAllMediaIndices.mockResolvedValue([]);

			mockSourceRepo.findById.mockResolvedValue(
				makeLocalSource("source-1", "/local/images"),
			);
			mockJobRepo.createIfUnique.mockResolvedValue({ id: "job-new" });

			await service.performStartupChecks();

			// One job per missing-metadata media item
			expect(mockJobRepo.createIfUnique).toHaveBeenCalledTimes(2);

			// Jobs should be created with skipThumbnailGeneration: true
			expect(mockJobRepo.createIfUnique).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "processMedia",
					mediaSourceId: "source-1",
					payload: expect.objectContaining({
						mediaId: "media-1",
						sourcePath: "/local/images",
						skipThumbnailGeneration: true,
					}),
				}),
			);
		});

		it("should process items in chunks of 50", async () => {
			const TOTAL_ITEMS = 110;
			const items = Array.from({ length: TOTAL_ITEMS }, (_, i) =>
				makeMedia(`media-${i}`),
			);
			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue(items);
			mockMediaRepo.findAllMediaIndices.mockResolvedValue([]);

			mockSourceRepo.findById.mockResolvedValue(
				makeLocalSource("source-1", "/local/images"),
			);
			mockJobRepo.createIfUnique.mockResolvedValue({ id: "job-new" });

			await service.performStartupChecks();

			expect(mockJobRepo.createIfUnique).toHaveBeenCalledTimes(TOTAL_ITEMS);
		});

		it("should skip media whose source is not a local source", async () => {
			const media1 = makeMedia("media-remote", "source-remote");

			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([
				media1,
			]);
			mockMediaRepo.findAllMediaIndices.mockResolvedValue([]);

			// Source is of type "pixiv", not "local"
			mockSourceRepo.findById.mockResolvedValue({
				id: "source-remote",
				type: "pixiv",
				connectionInfo: {},
			});

			await service.performStartupChecks();

			expect(mockJobRepo.createIfUnique).not.toHaveBeenCalled();
		});

		it("should not create a duplicate job if createIfUnique returns null", async () => {
			const media1 = makeMedia("media-1");

			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([
				media1,
			]);
			mockMediaRepo.findAllMediaIndices.mockResolvedValue([]);

			mockSourceRepo.findById.mockResolvedValue(
				makeLocalSource("source-1", "/local/images"),
			);
			// Simulate "already queued" – createIfUnique returns null
			mockJobRepo.createIfUnique.mockResolvedValue(null);

			await service.performStartupChecks();

			// createIfUnique was still called, but its null return means no new job
			expect(mockJobRepo.createIfUnique).toHaveBeenCalledOnce();
		});
	});

	// --------------------------------------------------------------------------
	// queueMissingThumbnails (exercised via performStartupChecks)
	// --------------------------------------------------------------------------

	describe("queueMissingThumbnails", () => {
		it("should NOT create any jobs when all thumbnails exist", async () => {
			const media1 = makeMedia("media-1");

			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			// 1 item < BATCH_SIZE(1000) → loop exits after first fetch
			mockMediaRepo.findAllMediaIndices.mockResolvedValueOnce([media1]);

			// Thumbnail for media-1 already exists in the cache directory
			(fs.readdir as unknown as Mock).mockResolvedValue([
				"media-1.webp",
			] as any);

			await service.performStartupChecks();

			expect(mockJobRepo.createIfUnique).not.toHaveBeenCalled();
		});

		it("should create a job for media whose thumbnail is missing", async () => {
			const media1 = makeMedia("media-1");

			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			// 1 item < BATCH_SIZE(1000) → loop exits after first fetch
			mockMediaRepo.findAllMediaIndices.mockResolvedValueOnce([media1]);

			// The cache directory exists but is empty → thumbnail is missing
			(fs.readdir as unknown as Mock).mockResolvedValue([] as any);

			mockSourceRepo.findById.mockResolvedValue(
				makeLocalSource("source-1", "/local/images"),
			);
			mockJobRepo.createIfUnique.mockResolvedValue({ id: "job-new" });

			await service.performStartupChecks();

			expect(mockJobRepo.createIfUnique).toHaveBeenCalledOnce();
			expect(mockJobRepo.createIfUnique).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "processMedia",
					payload: expect.objectContaining({
						mediaId: "media-1",
						skipMetadataExtraction: true,
					}),
				}),
			);
		});

		it("should handle ENOENT gracefully and treat it as no thumbnails existing", async () => {
			const media1 = makeMedia("media-1");

			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			// 1 item < BATCH_SIZE(1000) → loop exits after first fetch
			mockMediaRepo.findAllMediaIndices.mockResolvedValueOnce([media1]);

			// ENOENT: directory does not exist yet → treat as empty → thumbnail missing
			const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
			(fs.readdir as unknown as Mock).mockRejectedValue(err);

			mockSourceRepo.findById.mockResolvedValue(
				makeLocalSource("source-1", "/local/images"),
			);
			mockJobRepo.createIfUnique.mockResolvedValue({ id: "job-new" });

			await service.performStartupChecks();

			expect(mockJobRepo.createIfUnique).toHaveBeenCalledOnce();
		});

		it("should fetch the next batch by last media id when a page is full", async () => {
			// Simulate exactly BATCH_SIZE (1000) items in the first batch.
			// The loop does NOT exit early and fetches the next page (which is empty).
			const BATCH_SIZE = 1000;
			const batch1 = Array.from({ length: BATCH_SIZE }, (_, i) =>
				makeMedia(`m-${i}`),
			);

			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			mockMediaRepo.findAllMediaIndices
				.mockResolvedValueOnce(batch1) // first page: full
				.mockResolvedValueOnce([]); // second page: empty → stop

			// All thumbnails exist (one set shared by all items in source-1)
			(fs.readdir as unknown as Mock).mockResolvedValue(
				batch1.map((m) => `${m.id}.webp`) as any,
			);

			await service.performStartupChecks();

			// Two calls: first full page, then the empty termination page
			expect(mockMediaRepo.findAllMediaIndices).toHaveBeenCalledTimes(2);
			expect(mockMediaRepo.findAllMediaIndices).toHaveBeenNthCalledWith(1, {
				limit: 1000,
				afterId: undefined,
			});
			expect(mockMediaRepo.findAllMediaIndices).toHaveBeenNthCalledWith(2, {
				limit: 1000,
				afterId: "m-999",
			});
			expect(mockJobRepo.createIfUnique).not.toHaveBeenCalled();
		});
	});

	describe("LanceDB startup behavior", () => {
		it("should queue one full LanceDB sync job per source without a cache during startup checks", async () => {
			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			mockMediaRepo.findAllMediaIndices.mockResolvedValue([]);
			mockSourceRepo.findAll.mockResolvedValue([
				makeLocalSource("source-1", "/path-1"),
				makeLocalSource("source-2", "/path-2"),
			]);
			mockJobRepo.createIfUnique.mockResolvedValue({ id: "job-new" });

			// Simulate manifest.json doesn't exist (ENOENT)
			const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
			(fs.readFile as unknown as Mock).mockRejectedValue(err);

			await service.performStartupChecks();

			expect(mockSourceRepo.findAll).toHaveBeenCalledOnce();
			expect(mockJobRepo.createIfUnique).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "sync_lancedb_full",
					mediaSourceId: "source-1",
				}),
			);
			expect(mockJobRepo.createIfUnique).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "sync_lancedb_full",
					mediaSourceId: "source-2",
				}),
			);
		});

		it("should queue delta sync job without queueing delta details if PostgreSQL and LanceDB are in sync", async () => {
			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			mockMediaRepo.findAllMediaIndices.mockResolvedValue([]);
			mockSourceRepo.findAll.mockResolvedValue([
				makeLocalSource("source-1", "/path-1"),
			]);
			mockJobRepo.createIfUnique.mockResolvedValue({ id: "job-new" });

			// Simulate manifest.json exists (version: 3)
			(fs.readFile as unknown as Mock).mockResolvedValue(
				JSON.stringify({ version: 3 }),
			);

			// Both LanceDB and Postgres have media-1
			mockReadMediaIds.mockResolvedValue(["media-1"]);
			mockMediaRepo.findAllPathsBySourceId.mockResolvedValue([
				{ id: "media-1", filePath: "/media/media-1.png" },
			]);

			await service.performStartupChecks();

			expect(mockQueueSourceLanceDBDelta).not.toHaveBeenCalled();
			expect(mockJobRepo.createIfUnique).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "sync_lancedb_delta",
					mediaSourceId: "source-1",
				}),
			);
		});

		it("should queue discrepancies to delta table and trigger delta sync job if discrepancies are found", async () => {
			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			mockMediaRepo.findAllMediaIndices.mockResolvedValue([]);
			mockSourceRepo.findAll.mockResolvedValue([
				makeLocalSource("source-1", "/path-1"),
			]);
			mockJobRepo.createIfUnique.mockResolvedValue({ id: "job-new" });

			// Simulate manifest.json exists (version: 3)
			(fs.readFile as unknown as Mock).mockResolvedValue(
				JSON.stringify({ version: 3 }),
			);

			// Postgres: media-1, media-2
			// LanceDB: media-2, media-3
			// Discrepancies: upsert [media-1], delete [media-3]
			mockReadMediaIds.mockResolvedValue(["media-2", "media-3"]);
			mockMediaRepo.findAllPathsBySourceId.mockResolvedValue([
				{ id: "media-1", filePath: "/media/media-1.png" },
				{ id: "media-2", filePath: "/media/media-2.png" },
			]);

			await service.performStartupChecks();

			expect(mockQueueSourceLanceDBDelta).toHaveBeenCalledTimes(2);
			expect(mockQueueSourceLanceDBDelta).toHaveBeenNthCalledWith(
				1,
				"source-1",
				["media-1"],
				"upsert",
				{ enqueueJob: false },
			);
			expect(mockQueueSourceLanceDBDelta).toHaveBeenNthCalledWith(
				2,
				"source-1",
				["media-3"],
				"delete",
				{ enqueueJob: false },
			);

			expect(mockJobRepo.createIfUnique).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "sync_lancedb_delta",
					mediaSourceId: "source-1",
				}),
			);
		});

		it("should fall back to full sync if comparison throws an error", async () => {
			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			mockMediaRepo.findAllMediaIndices.mockResolvedValue([]);
			mockSourceRepo.findAll.mockResolvedValue([
				makeLocalSource("source-1", "/path-1"),
			]);
			mockJobRepo.createIfUnique.mockResolvedValue({ id: "job-new" });

			// Simulate manifest.json exists (version: 3)
			(fs.readFile as unknown as Mock).mockResolvedValue(
				JSON.stringify({ version: 3 }),
			);

			// readMediaIds throws error
			mockReadMediaIds.mockRejectedValue(new Error("LanceDB read error"));

			await service.performStartupChecks();

			expect(mockQueueSourceLanceDBDelta).not.toHaveBeenCalled();
			expect(mockJobRepo.createIfUnique).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "sync_lancedb_full",
					mediaSourceId: "source-1",
				}),
			);
		});
	});
});
