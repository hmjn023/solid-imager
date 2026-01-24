import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "~/application/registry";
import { MediaService } from "~/application/services/media-service";
import { db } from "~/infrastructure/db/index";
import {
  authors,
  characters,
  ips,
  mediaAuthors,
  mediaCharacters,
  mediaIps,
  mediaProjects,
  mediaSources,
  medias,
  projects,
} from "~/infrastructure/db/schema";
import { generateThumbnail } from "~/infrastructure/jobs/thumbnails";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";

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
  // biome-ignore lint/style/useNamingConvention: Mocking PascalCase export
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
    services.registerMediaRepository(MediaRepository);
    services.registerSourceRepository(new DrizzleSourceRepository());
    services.registerTagRepository({
      addTagsToMedia: vi.fn(),
    } as any);
    services.registerAuthorRepository({
      addMediaBulk: vi.fn(),
      create: vi.fn(),
      addMedia: vi.fn(),
    } as any);
    services.registerProjectRepository({
      findByMediaId: vi.fn().mockResolvedValue([]),
      addMediaBulk: vi.fn(),
    } as any);
    services.registerCharacterRepository({
      findByMediaId: vi.fn().mockResolvedValue([]),
      addToMediaBulk: vi.fn(),
    } as any);
    services.registerIpRepository({
      findByMediaId: vi.fn().mockResolvedValue([]),
      addMediaBulk: vi.fn(),
    } as any);
    services.registerStorageService(mockStorageService as any);
    services.registerImageProcessor(mockImageProcessor as any);
    services.registerAiClient(mockAiClient as any);

    // Clean DB
    await db.delete(mediaProjects);
    await db.delete(mediaCharacters);
    await db.delete(mediaIps);
    await db.delete(mediaAuthors);
    await db.delete(medias);
    await db.delete(projects);
    await db.delete(characters);
    await db.delete(ips);
    await db.delete(authors);
    await db.delete(mediaSources);

    // Create Sources
    // Create Sources (Mocked Repository)
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
    services.registerSourceRepository(mockSourceRepository as any);

    // Mock JobRepository
    const mockJobRepo = {
      create: vi.fn((job) => {
        capturedJobs.push(job);
        return Promise.resolve({ ...job, id: "job-id" });
      }),
    };
    services.registerJobRepository(mockJobRepo as any);
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
      // Add other methods if needed
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
