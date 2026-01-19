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

describe("processDownloadJob", () => {
  beforeEach(() => {
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

  it("should process a direct image download", async () => {
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
    expect(MediaRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Test Description",
        mediaSourceId: "source-1",
        sourceUrls: [
          "https://example.com/image.jpg",
          "https://x.com/user/status/123",
        ],
      })
    );
    expect(AuthorRepository.create).toHaveBeenCalledWith({
      name: "User",
      accountId: "@user",
    });
  });

  it("should use description if provided", async () => {
    const item = {
      targetUrl: "https://example.com/image.png",
      description: "My Description",
    };
    await processDownloadJob({} as any, "source-1", item);

    expect(MediaRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "My Description",
      })
    );
  });
});
