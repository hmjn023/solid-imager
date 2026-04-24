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

// Mock node:fs/promises to control thumbnail directory reads
vi.mock("node:fs/promises", () => ({
	default: {
		readdir: vi.fn(),
	},
}));

// Mock getSourceCacheDir to return a predictable path
vi.mock("~/infrastructure/jobs/thumbnails", () => ({
	getSourceCacheDir: vi.fn((sourceId: string) => `/cache/${sourceId}`),
}));

// Silence logger output during tests
vi.mock("~/infrastructure/logger", () => ({
	logger: {
		info: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		fatal: vi.fn(),
	},
	updateLogLevel: vi.fn(),
}));

// ---- Repository mocks ----

const mockMediaRepo = {
	findIdsWithMissingGenerationInfo: vi.fn(),
	findAllMediaIndices: vi.fn(),
};

const mockJobRepo = {
	createIfUnique: vi.fn(),
};

const mockSourceRepo = {
	findById: vi.fn(),
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
	});

	afterEach(() => {
		vi.clearAllMocks();
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

			// Jobs should be created with metadata-only steps.
			expect(mockJobRepo.createIfUnique).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "processMedia",
					mediaSourceId: "source-1",
					payload: expect.objectContaining({
						mediaId: "media-1",
						sourcePath: "/local/images",
						steps: ["extractMetadata", "queueAutoTagging"],
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
						steps: ["generateThumbnail"],
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

		it("should stop fetching batches when batch size equals BATCH_SIZE (simulate full page)", async () => {
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
			expect(mockMediaRepo.findAllMediaIndices).toHaveBeenNthCalledWith(
				1,
				undefined,
				{
					limit: 1000,
					offset: 0,
				},
			);
			expect(mockMediaRepo.findAllMediaIndices).toHaveBeenNthCalledWith(
				2,
				undefined,
				{
					limit: 1000,
					offset: 1000,
				},
			);
			expect(mockJobRepo.createIfUnique).not.toHaveBeenCalled();
		});
	});
});
