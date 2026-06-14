import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vite-plus/test";
import { services } from "~/application/registry";
import { MediaService } from "~/application/services/media-service";
import { generateThumbnail } from "~/infrastructure/jobs/thumbnails";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";

// Helper to capture jobs and processor
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
		services.reset();
		// Define Mocks
		const mockTagRepo = { addTagsToMedia: vi.fn() } as any;
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
			create: vi.fn((job) => {
				capturedJobs.push(job);
				return Promise.resolve({ ...job, id: "job-id" });
			}),
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
		const { MediaProcessingServiceImpl } = await import(
			"~/application/services/media-processing-service"
		);
		const mediaProcessingService = new MediaProcessingServiceImpl({
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
			generateThumbnail: generateThumbnail as any,
			sseSendEvent: vi.fn() as any,
		});
		services.registerMediaProcessingService(mediaProcessingService);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("should trigger generateThumbnail by using processMedia job type", async () => {
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

		// 2. Execute Copy
		const result = await MediaService.copyMedia(sourceMedia.id, targetSourceId);

		// Verify Copy Success
		expect(result.success).toBe(true);

		// 3. Verify Job creation
		expect(capturedJobs.length).toBeGreaterThan(0);
		const job = capturedJobs[0];

		// Check Job Type (This is what we are fixing, but assuming we want to test the EFFECT first)
		// If the job type is wrong ("thumbnail"), the processor will skip it.

		// 4. Manually trigger the processor
		// Since we don't capture processor via startJobQueue anymore, we must call executeProcessMediaJob directly
		// or rely on the fact that MediaService calls jobRepo.create.
		// The test logic wants to verify that "If the job type is correct, generateThumbnail is called".
		// So we can manually invoke MediaProcessingService.executeProcessMediaJob(job)

		// But failing to see MediaProcessingService being used?
		// MediaService.copyMedia calls jobRepo.create.
		const { MediaProcessingService } = await import(
			"~/application/services/media-processing-service"
		);
		await MediaProcessingService.executeProcessMediaJob(job);

		// 5. Assert generateThumbnail was called
		// If job type is "thumbnail", executeProcessMediaJob will return early and this will FAIL.
		// If job type is "processMedia", it will call generateThumbnail.
		expect(generateThumbnail).toHaveBeenCalled();
	});
});
