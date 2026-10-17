import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileWatcherService } from "~/infrastructure/jobs/file-watcher-service";
import { MaintenanceService } from "~/infrastructure/services/maintenance-service";

// ---- Module mocks ----

// Mock node:fs/promises to control checks for individual thumbnails.
vi.mock("node:fs/promises", () => ({
	default: {
		access: vi.fn(),
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
	},
}));

vi.mock("~/infrastructure/jobs/file-watcher-service", () => ({
	FileWatcherService: {
		startMonitoringAll: vi.fn().mockResolvedValue(undefined),
	},
}));

// ---- Repository mocks ----

const mockMediaRepo = {
	findIdsWithMissingGenerationInfo: vi.fn(),
	findAllMediaIndices: vi.fn(),
};

const mockProcessing = {
	requestTask: vi.fn(),
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
		vi.mocked(fs.access).mockReset().mockResolvedValue(undefined);
		service = new MaintenanceService(
			mockMediaRepo as any,
			mockProcessing as any,
			mockSourceRepo as any,
		);
		mockSourceRepo.findAll.mockResolvedValue([]);
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
			expect(mockSourceRepo.findAll).not.toHaveBeenCalled();
			expect(FileWatcherService.startMonitoringAll).toHaveBeenCalledOnce();
			expect(
				mockMediaRepo.findAllMediaIndices.mock.invocationCallOrder[0],
			).toBeLessThan(
				vi.mocked(FileWatcherService.startMonitoringAll).mock
					.invocationCallOrder[0],
			);
		});
	});

	// --------------------------------------------------------------------------
	// queueMissingMetadata (exercised via performStartupChecks)
	// --------------------------------------------------------------------------

	describe("queueMissingMetadata", () => {
		it("should NOT create any requests when there are no media with missing generation info", async () => {
			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			mockMediaRepo.findAllMediaIndices.mockResolvedValue([]);

			await service.performStartupChecks();

			expect(mockProcessing.requestTask).not.toHaveBeenCalled();
		});

		it("should create a request for each media that is missing generation info", async () => {
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
			mockProcessing.requestTask.mockResolvedValue({ id: "request-new" });

			await service.performStartupChecks();

			// One request per missing-metadata media item
			expect(mockProcessing.requestTask).toHaveBeenCalledTimes(2);

			// Jobs should be created with skipThumbnailGeneration: true
			expect(mockProcessing.requestTask).toHaveBeenCalledWith(
				"source-1",
				"media-1",
				"metadata",
				false,
				undefined,
				true,
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
			mockProcessing.requestTask.mockResolvedValue({ id: "request-new" });

			await service.performStartupChecks();

			expect(mockProcessing.requestTask).toHaveBeenCalledTimes(TOTAL_ITEMS);
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

			expect(mockProcessing.requestTask).not.toHaveBeenCalled();
		});

		it("should not create a duplicate request if requestTask returns null", async () => {
			const media1 = makeMedia("media-1");

			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([
				media1,
			]);
			mockMediaRepo.findAllMediaIndices.mockResolvedValue([]);

			mockSourceRepo.findById.mockResolvedValue(
				makeLocalSource("source-1", "/local/images"),
			);
			// Simulate "already queued" – requestTask returns null
			mockProcessing.requestTask.mockResolvedValue(null);

			await service.performStartupChecks();

			// requestTask was still called, but its null return means no new request
			expect(mockProcessing.requestTask).toHaveBeenCalledOnce();
		});
	});

	// --------------------------------------------------------------------------
	// queueMissingThumbnails (exercised via performStartupChecks)
	// --------------------------------------------------------------------------

	describe("queueMissingThumbnails", () => {
		it("checks each thumbnail once across pages with bounded filesystem concurrency", async () => {
			const items = Array.from({ length: 1001 }, (_, index) =>
				makeMedia(`paged-${index}`),
			);
			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			mockMediaRepo.findAllMediaIndices
				.mockResolvedValueOnce(items.slice(0, 1000))
				.mockResolvedValueOnce(items.slice(1000));
			let active = 0;
			let peak = 0;
			vi.mocked(fs.access).mockImplementation(async () => {
				active++;
				peak = Math.max(peak, active);
				await Promise.resolve();
				active--;
			});
			await service.performStartupChecks();
			expect(fs.access).toHaveBeenCalledTimes(1001);
			expect(peak).toBeLessThanOrEqual(16);
			expect(mockProcessing.requestTask).not.toHaveBeenCalled();
		});
		it("does not regenerate thumbnails on a permission failure", async () => {
			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			mockMediaRepo.findAllMediaIndices.mockResolvedValueOnce([
				makeMedia("private"),
			]);
			vi.mocked(fs.access).mockRejectedValue(
				Object.assign(new Error("EACCES"), { code: "EACCES" }),
			);
			await service.performStartupChecks();
			expect(mockProcessing.requestTask).not.toHaveBeenCalled();
		});
		it("should NOT create any requests when all thumbnails exist", async () => {
			const media1 = makeMedia("media-1");

			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			// 1 item < BATCH_SIZE(1000) → loop exits after first fetch
			mockMediaRepo.findAllMediaIndices.mockResolvedValueOnce([media1]);

			// Thumbnail for media-1 already exists in the cache directory
			vi.mocked(fs.access).mockResolvedValue(undefined);

			await service.performStartupChecks();

			expect(mockProcessing.requestTask).not.toHaveBeenCalled();
		});

		it("should create a request for media whose thumbnail is missing", async () => {
			const media1 = makeMedia("media-1");

			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			// 1 item < BATCH_SIZE(1000) → loop exits after first fetch
			mockMediaRepo.findAllMediaIndices.mockResolvedValueOnce([media1]);

			// The cache directory exists but is empty → thumbnail is missing
			vi.mocked(fs.access).mockRejectedValue(
				Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
			);

			mockSourceRepo.findById.mockResolvedValue(
				makeLocalSource("source-1", "/local/images"),
			);
			mockProcessing.requestTask.mockResolvedValue({ id: "request-new" });

			await service.performStartupChecks();

			expect(mockProcessing.requestTask).toHaveBeenCalledOnce();
			expect(mockProcessing.requestTask).toHaveBeenCalledWith(
				"source-1",
				"media-1",
				"thumbnail",
				false,
				undefined,
				true,
			);
		});

		it("should handle ENOENT gracefully and treat it as no thumbnails existing", async () => {
			const media1 = makeMedia("media-1");

			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			// 1 item < BATCH_SIZE(1000) → loop exits after first fetch
			mockMediaRepo.findAllMediaIndices.mockResolvedValueOnce([media1]);

			// ENOENT: directory does not exist yet → treat as empty → thumbnail missing
			const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
			vi.mocked(fs.access).mockRejectedValue(err);

			mockSourceRepo.findById.mockResolvedValue(
				makeLocalSource("source-1", "/local/images"),
			);
			mockProcessing.requestTask.mockResolvedValue({ id: "request-new" });

			await service.performStartupChecks();

			expect(mockProcessing.requestTask).toHaveBeenCalledOnce();
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
			vi.mocked(fs.access).mockResolvedValue(undefined);

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
			expect(mockProcessing.requestTask).not.toHaveBeenCalled();
		});
	});
});
