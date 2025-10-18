import { v4 as uuidv4 } from "uuid";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import {
  addMedia,
  deleteMedia,
  getMedia,
  listMedia,
  updateMedia,
} from "~/infrastructure/api-clients/media";
import {
  addMediaToMockDb,
  deleteMedia as dbDeleteMedia,
  updateMedia as dbUpdateMedia,
  insertMedia,
  resetMockDbState,
  selectMediaById,
  selectMediaBySourceIdAndDirectoryPath,
  selectMediaBySourceIdAndFilePath,
} from "~/infrastructure/db";

vi.mock("~/infrastructure/db");

describe("Media API Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockDbState();
    // Populate mockDbState.medias for updateMedia test
    const mediaId = "a0000000-0000-4000-8000-000000000000";
    const sourceId = "b0000000-0000-4000-8000-000000000000";
    const existingMedia = {
      id: mediaId,
      sourceId,
      filePath: "/mock/path/image.png",
      fileName: "original_file.png",
      mediaType: "image",
      width: 800,
      height: 600,
      fileSize: 1024,
      createdAt: new Date(),
      modifiedAt: new Date(),
      indexedAt: new Date(),
    };
    addMediaToMockDb(existingMedia);

    // Directly add to the mock state for selectMediaById to find it
    // This bypasses the insertMedia mock for setup purposes
    vi.mocked(selectMediaBySourceIdAndFilePath).mockImplementation(
      (srcId, filePath) => {
        if (srcId === sourceId && filePath === existingMedia.filePath) {
          return Promise.resolve([existingMedia]);
        }
        return Promise.resolve([]);
      }
    );
  });

  describe("addMedia", () => {
    it("should add a new media entry and return it", async () => {
      const newMediaData = {
        sourceId: "b0000000-0000-4000-8000-000000000000",
        filePath: "/unit/test/image.png",
        fileName: "unit_image.png",
        size: 500,
        mediaType: "image" as const,
        width: 100,
        height: 100,
      };

      // Mock selectMediaBySourceIdAndFilePath to return an empty array
      vi.mocked(selectMediaBySourceIdAndFilePath).mockResolvedValueOnce([]);
      // Mock insertMedia to return the newly inserted media
      vi.mocked(insertMedia).mockResolvedValueOnce([
        {
          id: uuidv4(),
          sourceId: newMediaData.sourceId,
          filePath: newMediaData.filePath,
          fileName: newMediaData.fileName,
          mediaType: newMediaData.mediaType,
          width: newMediaData.width,
          height: newMediaData.height,
          fileSize: newMediaData.size,
          createdAt: new Date(),
          modifiedAt: new Date(),
          indexedAt: new Date(),
        },
      ]);

      const result = await addMedia(newMediaData);

      expect(insertMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceId: newMediaData.sourceId,
          filePath: newMediaData.filePath,
        })
      );
      expect(result).toBeDefined();
      expect(result.fileName).toBe(newMediaData.fileName);
    });

    it("should throw a ZodError if required fields are missing", async () => {
      const invalidData = { filePath: "/path" };
      await expect(addMedia(invalidData as any)).rejects.toThrow(ZodError);
    });

    it("should throw an error if media with same sourceId and filePath already exists", async () => {
      const newMediaData = {
        sourceId: "b0000000-0000-4000-8000-000000000000",
        filePath: "/unit/test/duplicate.png",
        fileName: "unit_duplicate.png",
        size: 500,
        mediaType: "image" as const,
        width: 100,
        height: 100,
      };

      // Mock selectMediaBySourceIdAndFilePath to return an existing media
      vi.mocked(selectMediaBySourceIdAndFilePath).mockResolvedValueOnce([
        {
          id: "mock-existing-uuid",
          sourceId: newMediaData.sourceId,
          filePath: newMediaData.filePath,
          fileName: newMediaData.fileName,
          mediaType: newMediaData.mediaType,
          width: newMediaData.width,
          height: newMediaData.height,
          fileSize: newMediaData.size,
          createdAt: new Date(),
          modifiedAt: new Date(),
          indexedAt: new Date(),
        },
      ]);

      await expect(addMedia(newMediaData)).rejects.toThrow(
        "Media with this filePath already exists for the given sourceId"
      );
    });
  });

  describe("getMedia", () => {
    it("should retrieve a media entry by ID", async () => {
      const _sourceId = "b0000000-0000-4000-8000-000000000000";
      const mediaId = "a0000000-0000-4000-8000-000000000000";

      // Mock the return value of selectMediaById
      vi.mocked(selectMediaById).mockResolvedValueOnce([
        {
          id: mediaId,
          sourceId: _sourceId,
          filePath: "/mock/path/image.png",
          fileName: "image.png",
          mediaType: "image",
          width: 800,
          height: 600,
          fileSize: 1024,
          createdAt: new Date(),
          modifiedAt: new Date(),
          indexedAt: new Date(),
        },
      ]);

      const result = await getMedia(_sourceId, mediaId);

      expect(selectMediaById).toHaveBeenCalledWith(mediaId);
      expect(result).toBeDefined();
      expect(result.id).toBe(mediaId);
    });

    it("should throw an error if media ID is not found", async () => {
      const nonExistentMediaId = uuidv4();
      vi.mocked(selectMediaById).mockResolvedValueOnce([]);
      await expect(
        getMedia("b0000000-0000-4000-8000-000000000000", nonExistentMediaId)
      ).rejects.toThrow("Media not found");
    });

    it("should throw a ZodError for invalid media ID format", async () => {
      await expect(
        getMedia("b0000000-0000-4000-8000-000000000000", "invalid-format")
      ).rejects.toThrow(ZodError);
    });

    it("should throw a ZodError for invalid source ID format", async () => {
      await expect(getMedia("invalid-format", "mock-uuid-123")).rejects.toThrow(
        ZodError
      );
    });
  });

  describe("updateMedia", () => {
    it("should update a media entry and return the updated entry", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const mediaId = "a0000000-0000-4000-8000-000000000000";
      const updates = { fileName: "updated_file.png", width: 1024 }; // Define updates

      // The beforeEach hook already populates mockDbState.medias with existingMedia
      // and the global selectMediaById mock will return it.

      // Mock dbUpdateMedia to return the updated media
      vi.mocked(dbUpdateMedia).mockResolvedValueOnce([
        {
          id: mediaId,
          sourceId,
          filePath: "/mock/path/image.png",
          fileName: updates.fileName,
          mediaType: "image",
          width: updates.width,
          height: 600,
          fileSize: 1024,
          createdAt: new Date(),
          modifiedAt: new Date(),
          indexedAt: new Date(),
        },
      ]);

      const result = await updateMedia(sourceId, mediaId, updates);

      expect(selectMediaById).toHaveBeenCalledWith(mediaId);
      expect(dbUpdateMedia).toHaveBeenCalledWith(
        mediaId,
        expect.objectContaining(updates)
      );
      expect(result).toBeDefined();
      expect(result.fileName).toBe(updates.fileName);
    });

    it("should throw a ZodError for invalid update data", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const mediaId = "a0000000-0000-4000-8000-000000000000";
      const invalidUpdates = { width: -100 }; // Invalid field
      await expect(
        updateMedia(sourceId, mediaId, invalidUpdates as any)
      ).rejects.toThrow(ZodError);
    });

    it("should throw a ZodError for invalid media ID format", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const mediaId = "invalid-format";
      const updates = { fileName: "test" };
      await expect(updateMedia(sourceId, mediaId, updates)).rejects.toThrow(
        ZodError
      );
    });

    it("should throw a ZodError for invalid source ID format", async () => {
      const sourceId = "invalid-format";
      const mediaId = "mock-uuid-123";
      const updates = { fileName: "test" };
      await expect(updateMedia(sourceId, mediaId, updates)).rejects.toThrow(
        ZodError
      );
    });
  });

  describe("deleteMedia", () => {
    it("should delete a media entry and return success", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const mediaId = "a0000000-0000-4000-8000-000000000000";

      // Mock selectMediaById to return an existing media
      vi.mocked(selectMediaById).mockResolvedValueOnce([
        {
          id: mediaId,
          sourceId,
          filePath: "/mock/path/image.png",
          fileName: "image.png",
          mediaType: "image",
          width: 800,
          height: 600,
          fileSize: 1024,
          createdAt: new Date(),
          modifiedAt: new Date(),
          indexedAt: new Date(),
        },
      ]);

      // Mock dbDeleteMedia to return the deleted media
      vi.mocked(dbDeleteMedia).mockResolvedValueOnce([
        {
          id: mediaId,
          sourceId,
          filePath: "/mock/path/image.png",
          fileName: "image.png",
          mediaType: "image",
          width: 800,
          height: 600,
          fileSize: 1024,
          createdAt: new Date(),
          modifiedAt: new Date(),
          indexedAt: new Date(),
        },
      ]);

      const result = await deleteMedia(sourceId, mediaId);

      expect(selectMediaById).toHaveBeenCalledWith(mediaId);
      expect(dbDeleteMedia).toHaveBeenCalledWith(mediaId);
      expect(result).toEqual({ success: true });
    });

    it("should throw a ZodError for invalid media ID format", async () => {
      await expect(
        deleteMedia("b0000000-0000-4000-8000-000000000000", "invalid-format")
      ).rejects.toThrow(ZodError);
    });

    it("should throw a ZodError for invalid source ID format", async () => {
      await expect(
        deleteMedia("invalid-format", "mock-uuid-123")
      ).rejects.toThrow(ZodError);
    });
  });

  describe("listMedia", () => {
    it("should return a list of media entries for a given directory path", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const directoryPath = "/mock/directory/";

      // Mock selectMediaBySourceIdAndDirectoryPath to return a list of media entries
      vi.mocked(selectMediaBySourceIdAndDirectoryPath).mockResolvedValueOnce([
        {
          id: uuidv4(),
          sourceId,
          filePath: "/mock/directory/image1.png",
          fileName: "image1.png",
          mediaType: "image",
          width: 800,
          height: 600,
          fileSize: 1024,
          createdAt: new Date(),
          modifiedAt: new Date(),
          indexedAt: new Date(),
        },
        {
          id: uuidv4(),
          sourceId,
          filePath: "/mock/directory/image2.png",
          fileName: "image2.png",
          mediaType: "image",
          width: 1024,
          height: 768,
          fileSize: 2048,
          createdAt: new Date(),
          modifiedAt: new Date(),
          indexedAt: new Date(),
        },
      ]);

      const result = await listMedia(sourceId, directoryPath);

      expect(selectMediaBySourceIdAndDirectoryPath).toHaveBeenCalledWith(
        sourceId,
        directoryPath
      );
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it("should throw a ZodError if directory path is empty", async () => {
      await expect(
        listMedia("b0000000-0000-4000-8000-000000000000", "")
      ).rejects.toThrow(ZodError);
    });

    it("should throw a ZodError if source ID is invalid", async () => {
      await expect(
        listMedia("invalid-format", "/mock/directory/")
      ).rejects.toThrow(ZodError);
    });
  });
});
