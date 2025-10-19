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
  resetMockDbState,
} from "~/infrastructure/db/__mocks__";
import { NotFoundError } from "~/infrastructure/db/errors";
import {
  deleteMedia as deleteMediaDb,
  insertMedia,
  selectMediaById,
  selectMediaBySourceIdAndDirectoryPath,
  selectMediaBySourceIdAndFilePath,
  updateMedia as updateMediaDb,
} from "~/infrastructure/db/queries/media";
import { deleteThumbnail } from "~/infrastructure/jobs/thumbnails";

vi.mock("~/infrastructure/db/queries/media", () => ({
  selectMediaById: vi.fn(),
  selectMediaBySourceIdAndFilePath: vi.fn(),
  insertMedia: vi.fn(),
  updateMedia: vi.fn(),
  deleteMedia: vi.fn(),
  selectMediaBySourceIdAndDirectoryPath: vi.fn(),
}));

vi.mock("~/infrastructure/jobs/thumbnails", () => ({
  deleteThumbnail: vi.fn(),
}));

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
    (selectMediaBySourceIdAndFilePath as vi.Mock).mockImplementation(
      (srcId, filePath) => {
        if (srcId === sourceId && filePath === existingMedia.filePath) {
          return [existingMedia];
        }
        return [];
      }
    );

    (selectMediaById as vi.Mock).mockImplementation((id) => {
      if (id === mediaId) {
        return existingMedia;
      }
      return;
    });
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

      (selectMediaBySourceIdAndFilePath as vi.Mock).mockResolvedValueOnce([]);
      (insertMedia as vi.Mock).mockResolvedValueOnce({
        id: uuidv4(),
        ...newMediaData,
        createdAt: new Date(),
        modifiedAt: new Date(),
        indexedAt: new Date(),
      });

      const result = await addMedia(newMediaData);

      expect(insertMedia).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.fileName).toBe(newMediaData.fileName);
    });

    it("should throw a ZodError if required fields are missing", async () => {
      const invalidData = { filePath: "/path" };
      await expect(addMedia(invalidData as any)).rejects.toBeInstanceOf(
        ZodError
      );
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

      (selectMediaBySourceIdAndFilePath as vi.Mock).mockResolvedValueOnce([
        newMediaData,
      ]);

      await expect(addMedia(newMediaData)).rejects.toThrow(
        "Media with this filePath already exists for the given sourceId"
      );
    });
  });

  describe("getMedia", () => {
    it("should retrieve a media entry by ID", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const mediaId = "a0000000-0000-4000-8000-000000000000";

      (selectMediaById as vi.Mock).mockResolvedValueOnce({
        id: mediaId,
        sourceId,
        /* other fields */
      });

      const result = await getMedia(sourceId, mediaId);

      expect(selectMediaById).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe(mediaId);
    });

    it("should throw an error if media ID is not found", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const nonExistentMediaId = uuidv4();

      (selectMediaById as vi.Mock).mockRejectedValueOnce(
        new NotFoundError({ message: "Media not found" })
      );

      await expect(getMedia(sourceId, nonExistentMediaId)).rejects.toThrow(
        "Media not found"
      );
    });

    it("should throw a ZodError for invalid media ID format", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const invalidMediaId = "invalid-format";
      await expect(getMedia(sourceId, invalidMediaId)).rejects.toBeInstanceOf(
        ZodError
      );
    });

    it("should throw a ZodError for invalid source ID format", async () => {
      const invalidSourceId = "invalid-format";
      const mediaId = "mock-uuid-123";
      await expect(getMedia(invalidSourceId, mediaId)).rejects.toBeInstanceOf(
        ZodError
      );
    });
  });

  describe("updateMedia", () => {
    it("should update a media entry and return the updated entry", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const mediaId = "a0000000-0000-4000-8000-000000000000";
      const updates = { fileName: "updated_file.png", width: 1024 };

      (selectMediaById as vi.Mock).mockResolvedValueOnce({
        id: mediaId,
        sourceId,
        fileName: "original_file.png",
        width: 800,
      });
      (updateMediaDb as vi.Mock).mockResolvedValueOnce({
        id: mediaId,
        sourceId,
        fileName: updates.fileName,
        width: updates.width,
        /* other fields */
      });

      const result = await updateMedia(sourceId, mediaId, updates);

      expect(selectMediaById).toHaveBeenCalled();
      expect(updateMediaDb).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.fileName).toBe(updates.fileName);
    });

    it("should throw a ZodError for invalid update data", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const mediaId = "a0000000-0000-4000-8000-000000000000";
      const invalidUpdates = { width: -100 }; // Invalid field
      await expect(
        updateMedia(sourceId, mediaId, invalidUpdates as any)
      ).rejects.toBeInstanceOf(ZodError);
    });

    it("should throw a ZodError for invalid media ID format", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const mediaId = "invalid-format";
      const updates = { fileName: "test" };
      await expect(
        updateMedia(sourceId, mediaId, updates)
      ).rejects.toBeInstanceOf(ZodError);
    });

    it("should throw a ZodError for invalid source ID format", async () => {
      const sourceId = "invalid-format";
      const mediaId = "mock-uuid-123";
      const updates = { fileName: "test" };
      await expect(
        updateMedia(sourceId, mediaId, updates)
      ).rejects.toBeInstanceOf(ZodError);
    });
  });

  describe("deleteMedia", () => {
    it("should delete a media entry and return success", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const mediaId = "a0000000-0000-4000-8000-000000000000";

      (selectMediaById as vi.Mock).mockResolvedValueOnce({
        id: mediaId,
        sourceId,
        /* other fields */
      });
      (deleteMediaDb as vi.Mock).mockResolvedValueOnce([
        {
          id: mediaId,
        },
      ]);
      (deleteThumbnail as vi.Mock).mockResolvedValueOnce(undefined);

      const result = await deleteMedia(sourceId, mediaId);

      expect(selectMediaById).toHaveBeenCalled();
      expect(deleteMediaDb).toHaveBeenCalled();
      expect(deleteThumbnail).toHaveBeenCalledWith(mediaId);
      expect(result).toEqual({ success: true });
    });

    it("should throw a ZodError for invalid media ID format", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const mediaId = "invalid-format";
      await expect(deleteMedia(sourceId, mediaId)).rejects.toBeInstanceOf(
        ZodError
      );
    });

    it("should throw a ZodError for invalid source ID format", async () => {
      const sourceId = "invalid-format";
      const mediaId = "mock-uuid-123";
      await expect(deleteMedia(sourceId, mediaId)).rejects.toBeInstanceOf(
        ZodError
      );
    });
  });

  describe("listMedia", () => {
    it("should return a list of media entries for a given directory path", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const directoryPath = "/mock/directory/";

      (selectMediaBySourceIdAndDirectoryPath as vi.Mock).mockResolvedValueOnce([
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
      ]);

      const result = await listMedia(sourceId, directoryPath);

      expect(selectMediaBySourceIdAndDirectoryPath).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should throw a ZodError if directory path is empty", async () => {
      const sourceId = "665fc9fb-d2b9-49e2-beb3-63cf68fa2b11";
      await expect(listMedia(sourceId, "")).rejects.toBeInstanceOf(ZodError);
    });

    it("should throw a ZodError if source ID is invalid", async () => {
      const directoryPath = "/mock/directory/";
      await expect(
        listMedia("invalid-format", directoryPath)
      ).rejects.toBeInstanceOf(ZodError);
    });
  });
});
