import fs from "node:fs/promises";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";
import { FileWatcherService } from "~/infrastructure/jobs/file-watcher-service";
import { MaintenanceService } from "~/infrastructure/services/maintenance-service";

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

		it("should reuse a source listing across two populated pages", async () => {
			const firstPage = Array.from({ length: 1000 }, (_, i) =>
				makeMedia(`m-${i}`),
			);
			const secondPage = [makeMedia("m-1000"), makeMedia("missing")];
			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			mockMediaRepo.findAllMediaIndices
				.mockResolvedValueOnce(firstPage)
				.mockResolvedValueOnce(secondPage);
			(fs.readdir as unknown as Mock).mockResolvedValue(
				[...firstPage, secondPage[0]].map((media) => `${media.id}.webp`),
			);
			mockSourceRepo.findById.mockResolvedValue(
				makeLocalSource("source-1", "/local/images"),
			);
			mockJobRepo.createIfUnique.mockResolvedValue({ id: "job-new" });

			await service.performStartupChecks();

			expect(fs.readdir).toHaveBeenCalledOnce();
			expect(fs.readdir).toHaveBeenCalledWith("/cache/source-1");
			expect(mockMediaRepo.findAllMediaIndices).toHaveBeenCalledTimes(2);
			expect(mockJobRepo.createIfUnique).toHaveBeenCalledOnce();
			expect(mockJobRepo.createIfUnique).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						mediaId: "missing",
						skipMetadataExtraction: true,
					}),
				}),
			);
		});

		it("should keep source listings separate across pages", async () => {
			const firstPage = Array.from({ length: 1000 }, (_, i) =>
				makeMedia(`m-${i}`, i % 2 === 0 ? "source-1" : "source-2"),
			);
			const secondPage = [
				makeMedia("present-1", "source-1"),
				makeMedia("present-2", "source-2"),
			];
			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			mockMediaRepo.findAllMediaIndices
				.mockResolvedValueOnce(firstPage)
				.mockResolvedValueOnce(secondPage);
			(fs.readdir as unknown as Mock).mockImplementation(
				async (directory: string) =>
					[...firstPage, ...secondPage]
						.filter((media) => directory === `/cache/${media.mediaSourceId}`)
						.map((media) => `${media.id}.webp`),
			);

			await service.performStartupChecks();

			expect(fs.readdir).toHaveBeenCalledTimes(2);
			expect(fs.readdir).toHaveBeenCalledWith("/cache/source-1");
			expect(fs.readdir).toHaveBeenCalledWith("/cache/source-2");
			expect(mockJobRepo.createIfUnique).not.toHaveBeenCalled();
		});

		it("should reuse an absent directory result and queue all missing thumbnails across pages", async () => {
			const firstPage = Array.from({ length: 1000 }, (_, i) =>
				makeMedia(`m-${i}`),
			);
			const secondPage = [makeMedia("m-1000")];
			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			mockMediaRepo.findAllMediaIndices
				.mockResolvedValueOnce(firstPage)
				.mockResolvedValueOnce(secondPage);
			(fs.readdir as unknown as Mock).mockRejectedValue(
				Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
			);
			mockSourceRepo.findById.mockResolvedValue(
				makeLocalSource("source-1", "/local/images"),
			);
			mockJobRepo.createIfUnique.mockResolvedValue({ id: "job-new" });

			await service.performStartupChecks();

			expect(fs.readdir).toHaveBeenCalledOnce();
			expect(mockJobRepo.createIfUnique).toHaveBeenCalledTimes(1001);
			expect(
				mockJobRepo.createIfUnique.mock.calls.map(
					([job]) => job.payload.mediaId,
				),
			).toEqual([...firstPage, ...secondPage].map((media) => media.id));
		});

		it("should refresh source listings for the next startup scan", async () => {
			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			mockMediaRepo.findAllMediaIndices.mockResolvedValue([
				makeMedia("media-1"),
			]);
			(fs.readdir as unknown as Mock)
				.mockResolvedValueOnce(["media-1.webp"])
				.mockResolvedValueOnce([]);
			mockSourceRepo.findById.mockResolvedValue(
				makeLocalSource("source-1", "/local/images"),
			);
			mockJobRepo.createIfUnique.mockResolvedValue({ id: "job-new" });

			await service.performStartupChecks();
			expect(mockJobRepo.createIfUnique).not.toHaveBeenCalled();
			await service.performStartupChecks();

			expect(fs.readdir).toHaveBeenCalledTimes(2);
			expect(mockJobRepo.createIfUnique).toHaveBeenCalledOnce();
		});

		it("should retry a failed source read on the next page instead of caching the failure", async () => {
			const firstPage = Array.from({ length: 1000 }, (_, i) =>
				makeMedia(`m-${i}`),
			);
			mockMediaRepo.findIdsWithMissingGenerationInfo.mockResolvedValue([]);
			mockMediaRepo.findAllMediaIndices
				.mockResolvedValueOnce(firstPage)
				.mockResolvedValueOnce([makeMedia("missing")]);
			(fs.readdir as unknown as Mock)
				.mockRejectedValueOnce(Object.assign(new Error("EIO"), { code: "EIO" }))
				.mockResolvedValueOnce([]);
			mockSourceRepo.findById.mockResolvedValue(
				makeLocalSource("source-1", "/local/images"),
			);
			mockJobRepo.createIfUnique.mockResolvedValue({ id: "job-new" });

			await service.performStartupChecks();

			expect(fs.readdir).toHaveBeenCalledTimes(2);
			expect(mockJobRepo.createIfUnique).toHaveBeenCalledOnce();
			expect(mockJobRepo.createIfUnique).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ mediaId: "missing" }),
				}),
			);
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
});
