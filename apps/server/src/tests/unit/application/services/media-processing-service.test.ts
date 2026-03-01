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
  findByName: vi.fn(),
};
const mockCharacterRepo = {
  create: vi.fn(),
  addToMedia: vi.fn(),
  findByName: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
};
const mockIpRepo = {
  create: vi.fn(),
  addMedia: vi.fn(),
  findByName: vi.fn(),
};
const mockProjectRepo = {
  create: vi.fn(),
  addMedia: vi.fn(),
  findByName: vi.fn(),
};
const mockJobRepo = {
  create: vi.fn(),
};

const mockConfigService = {
  getConfig: vi.fn().mockReturnValue({
    jobs: {
      concurrency: 3,
      pollIntervalMs: 1000,
      enableAutoTagging: false,
    },
    media: {
      supportedExtensions: {
        image: [".jpg", ".jpeg", ".png", ".webp"],
        video: [".mp4", ".webm", ".mov"],
        audio: [".mp3", ".wav"],
      },
    },
  }),
  onChange: vi.fn(),
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
      mockProjectRepo as any,
      mockJobRepo as any,
      mockConfigService as any
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
      mockAuthorRepo.findByName.mockResolvedValue(null);
      mockAuthorRepo.create.mockResolvedValue({ id: "author-id" });

      await service.addContextMetadataToExistingMedia(mediaId, {
        authors: [{ name: "Author Name", accountId: "acc-123" }],
      });

      expect(mockAuthorRepo.findByName).toHaveBeenCalledWith("Author Name");
      expect(mockAuthorRepo.create).toHaveBeenCalledWith({
        name: "Author Name",
        accountId: "acc-123",
      });
      expect(mockAuthorRepo.addMedia).toHaveBeenCalledWith(
        mediaId,
        "author-id"
      );
    });

    it("should register characters and auto-assign their IPs if provided", async () => {
      const charId = "char-1";
      const ipId = "ip-1";
      const testConfidence = 0.9;
      mockMediaRepo.findById.mockResolvedValue({ id: mediaId });
      mockCharacterRepo.findByName.mockResolvedValue({
        id: charId,
        name: "Char Name",
        ips: [{ id: ipId, name: "IP Name" }],
      });

      await service.addContextMetadataToExistingMedia(mediaId, {
        characters: [{ name: "Char Name", confidence: testConfidence }],
      });

      expect(mockCharacterRepo.findByName).toHaveBeenCalledWith("Char Name");
      expect(mockCharacterRepo.addToMedia).toHaveBeenCalledWith(
        mediaId,
        charId,
        testConfidence
      );
      // Auto-assigned IP
      expect(mockIpRepo.addMedia).toHaveBeenCalledWith(
        mediaId,
        ipId,
        undefined,
        "character_link"
      );
    });

    it("should link new character to new IP if both are in the same context", async () => {
      const charName = "New Char";
      const ipName = "New IP";
      const ipId = "new-ip-id";
      const charId = "new-char-id";

      mockMediaRepo.findById.mockResolvedValue({ id: mediaId });

      // 1. IP registration (called first)
      mockIpRepo.findByName.mockResolvedValueOnce(null);
      mockIpRepo.create.mockResolvedValue({ id: ipId, name: ipName });
      mockIpRepo.findByName.mockResolvedValue({ id: ipId, name: ipName });

      // 2. Character registration (called second)
      mockCharacterRepo.findByName.mockResolvedValue(null);
      mockCharacterRepo.create.mockResolvedValue({
        id: charId,
        name: charName,
        ips: [{ id: ipId, name: ipName }],
      });
      // Re-fetch in update/registerCharacters
      mockCharacterRepo.findById.mockResolvedValue({
        id: charId,
        name: charName,
        ips: [{ id: ipId, name: ipName }],
      });

      await service.addContextMetadataToExistingMedia(mediaId, {
        characters: [{ name: charName }],
        ips: [{ name: ipName }],
      });

      // Verify IP was created
      expect(mockIpRepo.create).toHaveBeenCalledWith({
        name: ipName,
        description: "",
      });

      // Verify Character was created with IP ID
      expect(mockCharacterRepo.create).toHaveBeenCalledWith({
        name: charName,
        description: "",
        ipIds: [ipId],
      });

      // Verify both were linked to media
      expect(mockIpRepo.addMedia).toHaveBeenCalledWith(mediaId, ipId);
      expect(mockCharacterRepo.addToMedia).toHaveBeenCalledWith(
        mediaId,
        charId,
        undefined
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
