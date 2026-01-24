import { beforeEach, describe, expect, it, vi } from "vitest";
import { processDownloadJob } from "~/infrastructure/jobs/download-jobs";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { LocalMediaStorage } from "~/infrastructure/storage/local-media-storage";

// Mocks
vi.mock("~/infrastructure/repositories/source-repository");
vi.mock("~/infrastructure/repositories/media-repository");
vi.mock("~/infrastructure/repositories/author-repository");
vi.mock("~/infrastructure/storage/local-media-storage");
vi.mock("~/infrastructure/jobs/job-manager");
vi.mock("~/infrastructure/jobs/sse-manager");
vi.mock("~/application/services/media-processing-service", () => ({
  // biome-ignore lint/style/useNamingConvention: Mocking module export
  MediaProcessingService: {
    registerAndProcess: vi.fn(),
  },
}));
vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
  },
}));
vi.mock("node:child_process", () => ({
  execFile: vi.fn((_cmd, _args, _opts, cb) =>
    cb(null, { stdout: "", stderr: "" })
  ),
}));

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Regex for download filename pattern (moved to top level for performance)
const DOWNLOAD_FILENAME_PATTERN = /^download-\d+-image\.jpg$/;

describe("processDownloadJob", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(10),
    });

    // Default mocks
    vi.mocked(DrizzleSourceRepository.prototype.findById).mockResolvedValue({
      id: "source-1",
      name: "Local Source",
      type: "local",
      connectionInfo: { path: "/tmp/downloads" },
      createdAt: new Date(),
      updatedAt: new Date(),
      description: null,
    });

    vi.mocked(LocalMediaStorage.getFileMetadata).mockResolvedValue({
      size: 1000,
      createdAt: new Date(),
      modifiedAt: new Date(),
      width: 800,
      height: 600,
    });

    // Mock MediaProcessingService.registerAndProcess
    const { MediaProcessingService } = await import(
      "~/application/services/media-processing-service"
    );
    vi.mocked(MediaProcessingService.registerAndProcess).mockResolvedValue({
      id: "media-1",
      mediaSourceId: "source-1",
      filePath: "file.jpg",
      fileName: "file.jpg",
      mediaType: "image",
      width: 800,
      height: 600,
      fileSize: 1000,
      description: null,
      createdAt: new Date(),
      modifiedAt: new Date(),
      indexedAt: new Date(),
      status: "active",
    });

    vi.mocked(MediaRepository.create).mockResolvedValue({
      id: "media-1",
      mediaSourceId: "source-1",
      filePath: "file.jpg",
      fileName: "file.jpg",
      mediaType: "image",
      width: 800,
      height: 600,
      fileSize: 1000,
      description: null,
      createdAt: new Date(),
      modifiedAt: new Date(),
      indexedAt: new Date(),
      status: "active",
    });

    vi.mocked(AuthorRepository.create).mockResolvedValue({
      id: "author-1",
      name: "Author",
      accountId: "@author",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("should process a direct image download via MediaProcessingService", async () => {
    const { MediaProcessingService } = await import(
      "~/application/services/media-processing-service"
    );

    const item = {
      targetUrl: "https://example.com/image.jpg",
      description: "Test Description",
      sourceUrls: ["https://x.com/user/status/123"],
      authors: [{ name: "User", accountId: "@user" }],
    };

    await processDownloadJob({} as any, "source-1", item);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/image.jpg",
      expect.any(Object)
    );

    // Verify MediaProcessingService.registerAndProcess was called with correct context
    expect(MediaProcessingService.registerAndProcess).toHaveBeenCalledWith(
      "source-1",
      expect.stringMatching(DOWNLOAD_FILENAME_PATTERN),
      expect.objectContaining({
        description: "Test Description",
        sourceUrls: expect.arrayContaining([
          "https://example.com/image.jpg",
          "https://x.com/user/status/123",
        ]),
        authors: [{ name: "User", accountId: "@user" }],
      })
    );
  });

  it("should use description if provided", async () => {
    const { MediaProcessingService } = await import(
      "~/application/services/media-processing-service"
    );

    const item = {
      targetUrl: "https://example.com/image.png",
      description: "My Description",
    };
    await processDownloadJob({} as any, "source-1", item);

    expect(MediaProcessingService.registerAndProcess).toHaveBeenCalledWith(
      "source-1",
      expect.any(String),
      expect.objectContaining({
        description: "My Description",
      })
    );
  });
});
