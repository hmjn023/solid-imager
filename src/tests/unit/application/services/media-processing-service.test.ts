import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaProcessingServiceImpl } from "~/application/services/media-processing-service";

// Mock Repositories
const mockMediaRepo = {
  findById: vi.fn(),
  update: vi.fn(),
  addUrls: vi.fn(),
  upsertGenerationInfo: vi.fn(),
};
const mockTagRepo = {
  addTagsToMedia: vi.fn(),
};
const mockAuthorRepo = {
  create: vi.fn(),
  addMedia: vi.fn(),
};
const mockCharacterRepo = {
  create: vi.fn(),
  addToMedia: vi.fn(),
};
const mockIpRepo = {
  create: vi.fn(),
  addMedia: vi.fn(),
};
const mockProjectRepo = {
  create: vi.fn(),
  addMedia: vi.fn(),
};

describe("MediaProcessingService", () => {
  let service: MediaProcessingServiceImpl;

  beforeEach(() => {
    service = new MediaProcessingServiceImpl(
      {} as any, // SourceRepo
      mockMediaRepo as any,
      mockTagRepo as any,
      mockAuthorRepo as any,
      mockCharacterRepo as any,
      mockIpRepo as any,
      mockProjectRepo as any
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("addContextMetadataToExistingMedia", () => {
    const mediaId = "test-media-id";

    it("should update description if provided", async () => {
      mockMediaRepo.findById.mockResolvedValue({ id: mediaId });

      await service.addContextMetadataToExistingMedia(mediaId, {
        description: "New Description",
      });

      expect(mockMediaRepo.update).toHaveBeenCalledWith(mediaId, {
        description: "New Description",
      });
    });

    it("should register authors if provided", async () => {
      mockMediaRepo.findById.mockResolvedValue({ id: mediaId });
      mockAuthorRepo.create.mockResolvedValue({ id: "author-id" });

      await service.addContextMetadataToExistingMedia(mediaId, {
        authors: [{ name: "Author Name", accountId: "acc-123" }],
      });

      expect(mockAuthorRepo.create).toHaveBeenCalledWith({
        name: "Author Name",
        accountId: "acc-123",
      });
      expect(mockAuthorRepo.addMedia).toHaveBeenCalledWith(
        mediaId,
        "author-id"
      );
    });

    it("should throw error if media not found", async () => {
      mockMediaRepo.findById.mockResolvedValue(null);

      await expect(
        service.addContextMetadataToExistingMedia(mediaId, {
          description: "desc",
        })
      ).rejects.toThrow("Media not found");
    });
  });
});
