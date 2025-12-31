import { beforeEach, describe, expect, it, vi } from "vitest";
import { MediaServiceImpl } from "~/application/services/media-service";
import type { Media } from "~/domain/media/schemas";
import type { IMediaRepository } from "~/domain/repositories/media-repository";
import type { SourceRepository } from "~/domain/repositories/source-repository";
import type { TagRepository } from "~/domain/repositories/tag-repository";
import type { IImageProcessor } from "~/domain/services/image-processor";
import type { IStorageService } from "~/domain/services/storage-service";

const MEDIA_NOT_FOUND_REGEX = /media.*not found/i;

describe("MediaService Unit Tests", () => {
  let mediaService: MediaServiceImpl;
  let mockMediaRepository: IMediaRepository;
  let mockSourceRepository: SourceRepository;
  let mockStorageService: IStorageService;
  let mockTagRepository: TagRepository;
  let mockImageProcessor: IImageProcessor;

  beforeEach(() => {
    // Create mocks for all dependencies
    mockMediaRepository = {
      findById: vi.fn(),
      findByPath: vi.fn(),
      create: vi.fn(),
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
    } as unknown as IMediaRepository;

    mockSourceRepository = {
      findById: vi.fn(),
    } as unknown as SourceRepository;

    mockStorageService = {
      getFileStats: vi.fn(),
    } as unknown as IStorageService;

    mockTagRepository = {
      addTagsToMedia: vi.fn(),
    } as unknown as TagRepository;

    mockImageProcessor = {
      extractMetadata: vi.fn(),
    } as unknown as IImageProcessor;

    // Instantiate service with mocks
    mediaService = new MediaServiceImpl(
      mockMediaRepository,
      mockSourceRepository,
      mockStorageService,
      mockTagRepository,
      mockImageProcessor
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
      vi.mocked(mockMediaRepository.findById).mockResolvedValue(mockMedia);
      vi.mocked(mockMediaRepository.getTags).mockResolvedValue([]);
      vi.mocked(mockMediaRepository.getGenerationInfo).mockResolvedValue(null);
      vi.mocked(mockMediaRepository.getAuthors).mockResolvedValue([]);
      vi.mocked(mockMediaRepository.getUrls).mockResolvedValue([]);
      vi.mocked(mockSourceRepository.findById).mockResolvedValue(
        mockSource as any
      );
      // getFileStats removed as it is not in IStorageService and not used here
      vi.mocked(mockImageProcessor.extractMetadata).mockResolvedValue({
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
      vi.mocked(mockMediaRepository.findById).mockResolvedValue(null);

      await expect(
        mediaService.getMediaDetails(sourceId, mediaId)
      ).rejects.toThrow(MEDIA_NOT_FOUND_REGEX);
    });
  });
});
