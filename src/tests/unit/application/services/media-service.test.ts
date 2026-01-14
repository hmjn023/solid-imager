import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { MediaServiceImpl } from "~/application/services/media-service";
import type { Media } from "~/domain/media/schemas";
import type { IAuthorRepository } from "~/domain/repositories/author-repository";
import type { CharacterRepository } from "~/domain/repositories/character-repository";
import type { IIpRepository } from "~/domain/repositories/ip-repository";
import type { IMediaRepository } from "~/domain/repositories/media-repository";
import type { IProjectRepository } from "~/domain/repositories/project-repository";
import type { SourceRepository } from "~/domain/repositories/source-repository";
import type { TagRepository } from "~/domain/repositories/tag-repository";
import type { IImageProcessor } from "~/domain/services/image-processor";
import type { IStorageService } from "~/domain/services/storage-service";

const MEDIA_NOT_FOUND_REGEX = /media.*not found/i;
const MEDIA_SOURCE_NOT_FOUND_REGEX = /media source.*not found/i;

describe("MediaService Unit Tests", () => {
  let mediaService: MediaServiceImpl;
  let mockMediaRepository: IMediaRepository;
  let mockSourceRepository: SourceRepository;
  let mockStorageService: IStorageService;
  let mockTagRepository: TagRepository;
  let mockImageProcessor: IImageProcessor;
  let mockAuthorRepository: IAuthorRepository;
  let mockProjectRepository: IProjectRepository;
  let mockCharacterRepository: CharacterRepository;
  let mockIpRepository: IIpRepository;

  beforeEach(() => {
    // Create mocks for all dependencies
    mockMediaRepository = {
      findById: vi.fn(),
      findByPath: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      search: vi.fn(),
      findAllBySourceId: vi.fn(),
      searchInDirectory: vi.fn(),
      getTags: vi.fn(),
      getGenerationInfo: vi.fn(),
      getAuthors: vi.fn(),
      getUrls: vi.fn(),
      addUrls: vi.fn(),
      upsertGenerationInfo: vi.fn(),
      getDetails: vi.fn(),
    } as unknown as IMediaRepository;

    mockSourceRepository = {
      findById: vi.fn(),
    } as unknown as SourceRepository;

    mockStorageService = {
      getFileStats: vi.fn(),
      saveFile: vi.fn(),
      getFile: vi.fn(),
      scanDirectory: vi.fn(),
      getFileMetadata: vi.fn(),
      copyFile: vi.fn(),
      deleteFile: vi.fn(),
    } as unknown as IStorageService;

    mockTagRepository = {
      addTagsToMedia: vi.fn(),
    } as unknown as TagRepository;

    mockImageProcessor = {
      extractMetadata: vi.fn(),
    } as unknown as IImageProcessor;

    mockAuthorRepository = {
      create: vi.fn(),
      addMedia: vi.fn(),
    } as unknown as IAuthorRepository;

    mockProjectRepository = {
      findByMediaId: vi.fn(),
      addMedia: vi.fn(),
    } as unknown as IProjectRepository;

    mockCharacterRepository = {
      findByMediaId: vi.fn(),
      addToMedia: vi.fn(),
    } as unknown as CharacterRepository;

    mockIpRepository = {
      findByMediaId: vi.fn(),
      addMedia: vi.fn(),
    } as unknown as IIpRepository;

    // Instantiate service with mocks
    mediaService = new MediaServiceImpl(
      mockMediaRepository,
      mockSourceRepository,
      mockStorageService,
      mockTagRepository,
      mockImageProcessor,
      mockAuthorRepository,
      mockProjectRepository,
      mockCharacterRepository,
      mockIpRepository
    );
  });

  describe("getMediaDetails", () => {
    it("should return media details when found", async () => {
      // Valid v4 UUIDs
      const mediaId = "123e4567-e89b-42d3-a456-426614174000";
      const sourceId = "123e4567-e89b-42d3-a456-426614174001";
      const mockMedia: Media = {
        id: mediaId,
        mediaSourceId: sourceId,
        filePath: "/path/to/image.png",
        fileName: "image.png",
        mediaType: "image",
        width: 800,
        height: 600,
        fileSize: 1024,
        description: null,
        status: "active",
        createdAt: new Date(),
        modifiedAt: new Date(),
        indexedAt: new Date(),
      };

      const mockSource = {
        id: sourceId,
        name: "Test Source",
        type: "local",
        connectionInfo: { path: "/root" },
      };

      // Setup repository responses
      // Setup repository responses
      (mockMediaRepository.findById as Mock).mockResolvedValue(mockMedia);
      (mockMediaRepository.getTags as Mock).mockResolvedValue([]);
      (mockMediaRepository.getGenerationInfo as Mock).mockResolvedValue(null);
      (mockMediaRepository.getAuthors as Mock).mockResolvedValue([]);
      (mockMediaRepository.getUrls as Mock).mockResolvedValue([]);
      (mockSourceRepository.findById as Mock).mockResolvedValue(
        mockSource as any
      );
      // getFileStats removed as it is not in IStorageService and not used here
      // getFileStats removed as it is not in IStorageService and not used here
      (mockImageProcessor.extractMetadata as Mock).mockResolvedValue({
        tags: [],
        prompt: null,
        workflow: null,
      });

      // Call the method
      const result = await mediaService.getMediaDetails(sourceId, mediaId);

      // Verify interactions and result
      // The implementation parses the IDs first, then calls repository.
      expect(mockMediaRepository.findById).toHaveBeenCalledWith(mediaId);
      expect(result).toBeDefined();
      expect(result.id).toBe(mediaId);
      expect(mockImageProcessor.extractMetadata).toHaveBeenCalled();
    });

    it("should throw error if media not found", async () => {
      const mediaId = "123e4567-e89b-42d3-a456-426614174999";
      const sourceId = "123e4567-e89b-42d3-a456-426614174888";
      (mockMediaRepository.findById as Mock).mockResolvedValue(null);

      await expect(
        mediaService.getMediaDetails(sourceId, mediaId)
      ).rejects.toThrow(MEDIA_NOT_FOUND_REGEX);
    });
  });

  describe("uploadMedia", () => {
    it("should successfully upload and register media", async () => {
      const sourceId = "123e4567-e89b-42d3-a456-426614174001";
      const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");
      const file = new File([pngSignature], "test.png", { type: "image/png" });
      const options = {
        filename: "custom.png",
        description: "Test description",
        overwrite: true,
        autoIncrement: false,
      };

      const mockSource = {
        id: sourceId,
        type: "local",
        connectionInfo: { path: "/root" },
      };

      const mockFileInfo = {
        filePath: "custom.png",
        fileName: "custom.png",
        width: 100,
        height: 100,
        size: 4,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };

      const mockMedia = {
        id: "new-media-id",
        ...mockFileInfo,
        mediaSourceId: sourceId,
        mediaType: "image",
      };

      (mockSourceRepository.findById as Mock).mockResolvedValue(
        mockSource as any
      );
      (mockStorageService.saveFile as Mock).mockResolvedValue(
        mockFileInfo as any
      );
      (mockMediaRepository.upsert as Mock).mockResolvedValue(mockMedia as any);

      const result = await mediaService.uploadMedia(sourceId, file, options);

      expect(result.success).toBe(true);
      expect(mockStorageService.saveFile).toHaveBeenCalledWith(
        "/root",
        file,
        expect.objectContaining({
          filename: "custom.png",
          overwrite: true,
        })
      );
      expect(mockMediaRepository.upsert).toHaveBeenCalled();
    });

    it("should throw error if source not found", async () => {
      const sourceId = "123e4567-e89b-42d3-a456-426614174999";
      const file = new File(["test"], "test.png", { type: "image/png" });
      (mockSourceRepository.findById as Mock).mockResolvedValue(null);

      await expect(
        mediaService.uploadMedia(sourceId, file, {})
      ).rejects.toThrow(MEDIA_SOURCE_NOT_FOUND_REGEX);
    });

    it("should delete file if DB insertion fails (rollback)", async () => {
      const sourceId = "123e4567-e89b-42d3-a456-426614174001";
      const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");
      const file = new File([pngSignature], "test.png", { type: "image/png" });
      const options = { filename: "fail.png", overwrite: true };

      const mockSource = {
        id: sourceId,
        type: "local",
        connectionInfo: { path: "/root" },
      };

      const mockFileInfo = {
        filePath: "fail.png",
        fileName: "fail.png",
        width: 100,
        height: 100,
        size: 4,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };

      (mockSourceRepository.findById as Mock).mockResolvedValue(mockSource);
      (mockStorageService.saveFile as Mock).mockResolvedValue(mockFileInfo);
      (mockMediaRepository.upsert as Mock).mockRejectedValue(
        new Error("DB Error")
      );

      await expect(
        mediaService.uploadMedia(sourceId, file, options)
      ).rejects.toThrow("DB Error");

      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
        "/root",
        "fail.png"
      );
    });
  });
});
