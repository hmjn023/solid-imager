import { beforeEach, describe, expect, it, vi } from "vitest";
import { processDownloadJob } from "~/infrastructure/jobs/download-jobs";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";

// Hoisted mocks
// Hoisted mocks
const {
  mockFindById,
  mockGetFileMetadata,
  mockMediaRegisterAndProcess,
  mockMediaAddContextMetadata,
  mockMediaCreate,
  mockMediaUpdate,
  mockMediaAddUrls,
  mockMediaFindByPath,
  mockAuthorCreate,
  mockAuthorAddMedia,
  mockSaveFile,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockGetFileMetadata: vi.fn(),
  mockMediaRegisterAndProcess: vi.fn(),
  mockMediaAddContextMetadata: vi.fn(),
  mockMediaCreate: vi.fn(),
  mockMediaUpdate: vi.fn(),
  mockMediaAddUrls: vi.fn(),
  mockMediaFindByPath: vi.fn(),
  mockAuthorCreate: vi.fn(),
  mockAuthorAddMedia: vi.fn(),
  mockSaveFile: vi.fn(),
}));

// Mocks
vi.mock("~/infrastructure/repositories/source-repository", () => ({
  DrizzleSourceRepository: class {
    findById = mockFindById;
  },
}));
vi.mock("~/infrastructure/repositories/media-repository", () => ({
  MediaRepository: {
    create: mockMediaCreate,
    update: mockMediaUpdate,
    addUrls: mockMediaAddUrls,
    findByPath: mockMediaFindByPath,
  },
}));
vi.mock("~/infrastructure/repositories/author-repository", () => ({
  AuthorRepository: {
    create: mockAuthorCreate,
    addMedia: mockAuthorAddMedia,
  },
}));
vi.mock("~/infrastructure/storage/server-media-storage", () => ({
  ServerMediaStorage: {
    getFileMetadata: mockGetFileMetadata,
    saveFile: mockSaveFile,
  },
}));
// job-manager mock removed
vi.mock("~/infrastructure/jobs/sse-manager", () => ({
  SseManager: {
    sendEvent: vi.fn(),
  },
}));
vi.mock("~/application/services/media-processing-service", () => ({
  MediaProcessingService: {
    registerAndProcess: mockMediaRegisterAndProcess,
    addContextMetadataToExistingMedia: mockMediaAddContextMetadata,
  },

  MediaProcessingServiceImpl: class {},
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
const fetchMock = vi.fn(); // biome-ignore lint/suspicious/noExplicitAny: Mocking global fetch
global.fetch = fetchMock as any;

// Regex for download filename pattern (unified format: {author}_{date}_{id}.{ext})
const DOWNLOAD_FILENAME_PATTERN = /^user_.*123\.jpg$/;

describe("processDownloadJob", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(10),
    });

    // Default mocks
    mockFindById.mockResolvedValue({
      id: "source-1",
      name: "Local Source",
      type: "local",
      connectionInfo: { path: "/tmp/downloads" },
      createdAt: new Date(),
      updatedAt: new Date(),
      description: null,
    });

    mockGetFileMetadata.mockResolvedValue({
      size: 1000,
      createdAt: new Date(),
      modifiedAt: new Date(),
      width: 800,
      height: 600,
    });

    mockSaveFile.mockImplementation((_base, _file, options) => {
      const filename = options?.filename || "file.jpg";
      return Promise.resolve({
        filePath: filename,
        fileName: filename,
        width: 800,
        height: 600,
        size: 1000,
        createdAt: new Date(),
        modifiedAt: new Date(),
      });
    });

    mockMediaRegisterAndProcess.mockResolvedValue({
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

    mockMediaCreate.mockResolvedValue({
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

    mockAuthorCreate.mockResolvedValue({
      id: "author-1",
      name: "Author",
      accountId: "@author",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { services } = await import("~/application/registry");
    services.getJobRepository = vi.fn().mockReturnValue({
      create: vi.fn(),
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

    const job = {
      id: "job-1",
      mediaSourceId: "source-1",
      type: "downloadImage",
      payload: { ...item },
    } as any;

    await processDownloadJob(job);

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
    const job = {
      id: "job-2",
      mediaSourceId: "source-1",
      type: "downloadImage",
      payload: { ...item },
    } as any;

    await processDownloadJob(job);

    expect(MediaProcessingService.registerAndProcess).toHaveBeenCalledWith(
      "source-1",
      expect.any(String),
      expect.objectContaining({
        description: "My Description",
      })
    );
  });

  it("should update existing media metadata if file already exists", async () => {
    const { MediaProcessingService } = await import(
      "~/application/services/media-processing-service"
    );

    // Simulate file existing -> registerAndProcess throws -> catch block searches media -> updates
    const error = new Error("File already exists");
    mockMediaRegisterAndProcess.mockRejectedValueOnce(error);

    mockMediaFindByPath.mockResolvedValueOnce({
      id: "existing-media-id",
    } as any);

    const item = {
      targetUrl: "https://example.com/duplicate.jpg",
      description: "Updated Description",
      authors: [{ name: "New Author", accountId: "@new" }],
    };

    const job = {
      id: "job-3",
      mediaSourceId: "source-1",
      type: "downloadImage",
      payload: { ...item },
    } as any;

    await processDownloadJob(job);

    expect(MediaRepository.findByPath).toHaveBeenCalled();
    expect(
      MediaProcessingService.addContextMetadataToExistingMedia
    ).toHaveBeenCalledWith(
      "existing-media-id",
      expect.objectContaining({
        description: "Updated Description",
        authors: [{ name: "New Author", accountId: "@new" }],
      })
    );
  });
});
