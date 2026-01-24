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
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { DrizzleCharacterRepository } from "~/infrastructure/repositories/character-repository";
import { IpRepository } from "~/infrastructure/repositories/ip-repository";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { ProjectRepository } from "~/infrastructure/repositories/project-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { TagRepository } from "~/infrastructure/repositories/tag-repository";

// Helper to capture jobs and processor
let capturedJobs: any[] = [];
let capturedProcessor: ((job: any) => Promise<void>) | null = null;

// Mock Job Manager
vi.mock("~/infrastructure/jobs/job-manager", () => ({
  addJobsToQueue: vi.fn((_sourceId, jobs) => {
    capturedJobs.push(...jobs);
  }),
  startJobQueue: vi.fn((_sourceId, processor) => {
    capturedProcessor = processor;
  }),
  getJobStats: vi.fn(() => ({ status: "idle" })),
  // biome-ignore lint/style/useNamingConvention: Mocking PascalCase export
  SseManager: { sendEvent: vi.fn() }, // Mock SseManager inside job-manager export
}));

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
    capturedProcessor = null;

    // Reset registry and register services
    services.reset();
    services.registerMediaRepository(MediaRepository);
    services.registerSourceRepository(new DrizzleSourceRepository());
    services.registerTagRepository(TagRepository);
    services.registerAuthorRepository(AuthorRepository);
    services.registerProjectRepository(ProjectRepository);
    services.registerCharacterRepository(new DrizzleCharacterRepository());
    services.registerIpRepository(IpRepository);
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
    await db.insert(mediaSources).values([
      {
        id: sourceSourceId,
        name: "Source Source",
        type: "local",
        connectionInfo: { path: "/source" },
      },
      {
        id: targetSourceId,
        name: "Target Source",
        type: "local",
        connectionInfo: { path: "/target" },
      },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should trigger generateThumbnail by using processMedia job type", async () => {
    // 1. Prepare Source Media
    const [sourceMedia] = await db
      .insert(medias)
      .values({
        mediaSourceId: sourceSourceId,
        filePath: "/source/file.png",
        fileName: "file.png",
        mediaType: "image",
        width: 800,
        height: 600,
        fileSize: 1024,
      })
      .returning();

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
    expect(capturedProcessor).toBeTruthy();
    if (capturedProcessor) {
      await capturedProcessor(job);
    }

    // 5. Assert generateThumbnail was called
    // If job type is "thumbnail", executeProcessMediaJob will return early and this will FAIL.
    // If job type is "processMedia", it will call generateThumbnail.
    expect(generateThumbnail).toHaveBeenCalled();
  });
});
