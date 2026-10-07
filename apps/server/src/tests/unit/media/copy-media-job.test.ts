import { defaultAppConfig } from "@solid-imager/core/domain/config/config-schema";
import { processingSettingsFromConfig } from "@solid-imager/core/domain/processing/schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateThumbnail } from "~/infrastructure/jobs/thumbnails";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { services } from "~/infrastructure/service-registry";
import { MediaService } from "~/infrastructure/services/media-service";

// Helper to capture jobs and processor
const request = vi
	.fn()
	.mockResolvedValue({ requestId: "test", status: "pending" });
let capturedJobs: any[] = [];
let _capturedProcessor: ((job: any) => Promise<void>) | null = null;

// Mock Job Manager
// Mock JobManager (Removed)
// We mock JobRepository via services in beforeEach

// Mock Thumbnails
vi.mock("~/infrastructure/jobs/thumbnails", () => ({
	generateThumbnail: vi.fn(),
	deleteThumbnail: vi.fn(),
	getSourceCacheDir: vi.fn(),
	getThumbnailPath: vi.fn(),
}));

// Mock ImageProcessor Module (used by MediaProcessingService)
vi.mock("~/infrastructure/processing/image-processor", () => ({
	ImageProcessor: {
		extractMetadata: vi.fn().mockResolvedValue({
			width: 800,
			height: 600,
			tags: [],
			prompt: null,
			workflow: null,
		}),
		generateThumbnail: vi.fn(),
	},
}));

// Mock Other Services
const mockStorageService = {
	copyFile: vi.fn().mockResolvedValue({
		filePath: "/new/path/file.png",
		fileName: "file.png",
		width: 800,
		height: 600,
		size: 1024,
	}),
	deleteFile: vi.fn().mockResolvedValue(undefined),
	moveFile: vi.fn(),
	listFiles: vi.fn(),
	getFileStats: vi.fn(),
	createDirectory: vi.fn(),
	deleteDirectory: vi.fn(),
	watch: vi.fn(),
};

const mockImageProcessor = {
	extractMetadata: vi.fn(), // Needed for ProcessMedia job
	generateThumbnail: vi.fn(),
};

const mockAiClient = {
	generateImage: vi.fn(),
	analyzeImage: vi.fn(),
};

describe("Reproduction: Copy Media Job Type", () => {
	const sourceSourceId = "dce7b2a1-93ba-4c49-b1eb-f25dafb12949";
	const targetSourceId = "dce7b2a1-93ba-4c49-b1eb-f25dafb12950";

	beforeEach(async () => {
		// Reset Captures
		capturedJobs = [];
		_capturedProcessor = null;

		// Reset registry and register services
		await services.reset();
		// Define Mocks
		const mockTagRepo = {
			removeTagsFromSource: vi.fn(),
			addTagsToMedia: vi.fn(),
		} as any;
		const mockAuthorRepo = {
			addMediaBulk: vi.fn(),
			create: vi.fn(),
			addMedia: vi.fn(),
		} as any;
		const mockProjectRepo = {
			findByMediaId: vi.fn().mockResolvedValue([]),
			addMediaBulk: vi.fn(),
		} as any;
		const mockCharRepo = {
			findByMediaId: vi.fn().mockResolvedValue([]),
			addToMediaBulk: vi.fn(),
		} as any;
		const mockIpRepo = {
			findByMediaId: vi.fn().mockResolvedValue([]),
			addMediaBulk: vi.fn(),
		} as any;

		const mockSourceRepository = {
			findById: vi.fn((id) => {
				if (id === sourceSourceId) {
					return {
						id: sourceSourceId,
						name: "Source Source",
						type: "local",
						connectionInfo: { path: "/source" },
					};
				}
				if (id === targetSourceId) {
					return {
						id: targetSourceId,
						name: "Target Source",
						type: "local",
						connectionInfo: { path: "/target" },
					};
				}
				return null;
			}),
		};

		const mockJobRepo = {
			withActiveAttempt: vi.fn(async (_id, _attempt, action) =>
				action(undefined),
			),
			update: vi.fn(),
			create: vi.fn((job) => {
				capturedJobs.push({ ...job, id: "job-id", attemptCount: 1 });
				return Promise.resolve({ ...job, id: "job-id" });
			}),
			createIfUnique: vi.fn((job) =>
				Promise.resolve({ ...job, id: "sync-job-id" }),
			),
		};

		// Register Repositories
		services.registerSourceRepository(mockSourceRepository as any);
		services.registerJobRepository(mockJobRepo as any);
		services.registerTagRepository(mockTagRepo);
		services.registerAuthorRepository(mockAuthorRepo);
		services.registerProjectRepository(mockProjectRepo);
		services.registerCharacterRepository(mockCharRepo);
		services.registerIpRepository(mockIpRepo);

		// Register Services
		services.registerMediaRepository(MediaRepository);
		services.registerMediaStorage(mockStorageService as any);
		services.registerImageProcessor(mockImageProcessor as any);
		services.registerAiClient(mockAiClient as any);

		// Mock ConfigService
		const mockConfigService = {
			getConfig: vi.fn().mockReturnValue({
				jobs: {
					concurrency: 3,
					pollIntervalMs: 1000,
					enableAutoTagging: false,
				},
				ai: {
					baseUrl: "http://localhost:8000",
					timeoutMs: 30_000,
				},
				storage: {
					thumbnailDir: ".cache/thumbnails",
					thumbnailSize: 512,
					thumbnailQuality: 80,
				},
				media: {
					supportedExtensions: {
						image: [".jpg", ".jpeg", ".png", ".webp"],
						video: [".mp4", ".webm", ".mov"],
						audio: [".mp3", ".wav"],
					},
					tagExtraction: {
						comfyui: {
							positiveNodeTypes: ["CLIPTextEncode", "CR Combine Prompt"],
							negativeKeywords: ["negative"],
							negativeTags: ["lowres"],
						},
					},
				},
				logging: {
					level: "info",
				},
			}),
			onChange: vi.fn(),
		};
		services.registerConfigService(mockConfigService as any);

		// Instantiate and Register MediaProcessingService
		const { MediaProcessingServiceImpl } =
			await import("~/infrastructure/services/media-processing-service");
		const mediaProcessingService = new MediaProcessingServiceImpl({
			processingStateRepo: {
				request,
				claimDue: vi.fn(),
				recoverExpired: vi.fn(),
				settleFailure: vi.fn(),
				findInlineMediaIds: vi.fn(),
				findTaggingResult: vi.fn(),
				saveTaggingResult: vi.fn(),
				claim: vi
					.fn()
					.mockResolvedValue({ status: "claimed", claim: {}, state: {} }),
				commit: vi.fn(async (_input, _claim, output, tx) => output(tx)),
				fail: vi.fn().mockResolvedValue(true),
				heartbeat: vi.fn().mockResolvedValue(true),
				findByMediaIds: vi.fn().mockResolvedValue([]),
			},
			getProcessingSettings: () =>
				processingSettingsFromConfig(defaultAppConfig),
			hasThumbnails: vi.fn().mockResolvedValue(true),
			transactionManager: { transaction: async (action) => action(undefined) },
			publishJobProgress: vi.fn(),
			sourceRepo: mockSourceRepository as any,
			mediaRepo: MediaRepository as any,
			tagRepo: mockTagRepo,
			authorRepo: mockAuthorRepo,
			characterRepo: mockCharRepo,
			ipRepo: mockIpRepo,
			projectRepo: mockProjectRepo,
			jobRepo: mockJobRepo as any,
			imageProcessor: mockImageProcessor as any,
			mediaStorage: {} as any,
			enableAutoTagging: false,
			supportedExtensions: {
				image: [".jpg", ".jpeg", ".png", ".webp"],
				video: [".mp4", ".webm", ".mov"],
				audio: [".mp3", ".wav"],
			},
			prepareThumbnail: vi
				.fn()
				.mockResolvedValue({ commit: generateThumbnail, cleanup: vi.fn() }),
			publishSourceEvent: vi.fn() as any,
		});
		services.registerMediaProcessingService(mediaProcessingService);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("reserves dedicated file work without creating a processMedia job", async () => {
		// 1. Prepare Source Media
		// 1. Prepare Source Media
		const sourceMedia = {
			id: "123e4567-e89b-42d3-a456-426614174000",
			mediaSourceId: sourceSourceId,
			filePath: "/source/file.png",
			fileName: "file.png",
			mediaType: "image",
			width: 800,
			height: 600,
			fileSize: 1024,
			modifiedAt: new Date(),
		};

		// Mock MediaRepository.findById (used by MediaService.copyMedia)
		// Note: MediaService.copyMedia calls this.mediaRepository.findById(mediaId)
		const mockMediaRepository = {
			findById: vi.fn().mockResolvedValue(sourceMedia),
			create: vi.fn().mockResolvedValue({
				...sourceMedia,
				id: "123e4567-e89b-42d3-a456-426614174001",
				mediaSourceId: targetSourceId,
			}),
			getAuthors: vi.fn().mockResolvedValue([]),
			getUrls: vi.fn().mockResolvedValue([]),
			upsertGenerationInfo: vi.fn(),
		};
		services.registerMediaRepository(mockMediaRepository as any);

		vi.spyOn(MediaRepository, "findById").mockResolvedValue({
			...sourceMedia,
			id: "123e4567-e89b-42d3-a456-426614174001",
			mediaSourceId: targetSourceId,
		} as any);
		// 2. Execute Copy
		const result = await MediaService.copyMedia(sourceMedia.id, targetSourceId);

		// Verify Copy Success
		expect(result.success).toBe(true);

		expect(capturedJobs).toHaveLength(0);
		expect(generateThumbnail).not.toHaveBeenCalled();
		expect(request).toHaveBeenCalledTimes(2);
		expect(
			request.mock.calls
				.map(([value]) => value.taskKind)
				.sort((a, b) => a.localeCompare(b)),
		).toEqual(["metadata", "thumbnail"]);
	});
});
