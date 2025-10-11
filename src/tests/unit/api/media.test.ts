import { eq, like } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { medias } from "~/infrastructure/db/schema";
import {
  addMedia,
  deleteMedia,
  getMedia,
  listMedia,
  updateMedia,
} from "~/infrastructure/api-clients/media";
import { db } from "~/infrastructure/db";

// データベースの操作をモックします。
vi.mock("~/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => [
          {
            id: uuidv4(),
            sourceId: "mock-source-id",
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
        ]),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => [
          {
            id: "mock-uuid-123",
            sourceId: "mock-source-id",
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
        ]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => [
            {
              id: "mock-uuid-123",
              sourceId: "mock-source-id",
              filePath: "/mock/path/image.png",
              fileName: "updated_image.png",
              mediaType: "image",
              width: 1024,
              height: 768,
              fileSize: 1024,
              createdAt: new Date(),
              modifiedAt: new Date(),
              indexedAt: new Date(),
            },
          ]),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => [
          {
            id: "mock-uuid-123",
            sourceId: "mock-source-id",
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
        ]),
      })),
    })),
  },
}));

describe("Media API Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addMedia", () => {
    it("should add a new media entry and return it", async () => {
      const newMediaData = {
        sourceId: "b0000000-0000-0000-0000-000000000000",
        filePath: "/unit/test/image.png",
        fileName: "unit_image.png",
        size: 500,
        mediaType: "image" as const,
        width: 100,
        height: 100,
      };

      const result = await addMedia(newMediaData);

      expect(db.insert).toHaveBeenCalledWith(medias);
      expect(result).toBeDefined();
      expect(result.fileName).toBe(newMediaData.fileName);
    });

    it("should throw a ZodError if required fields are missing", async () => {
      const invalidData = { filePath: "/path" };
      await expect(addMedia(invalidData as any)).rejects.toThrow(ZodError);
    });

    it("should throw an error if media with same sourceId and filePath already exists", async () => {
      const newMediaData = {
        sourceId: "b0000000-0000-0000-0000-000000000000",
        filePath: "/unit/test/duplicate.png",
        fileName: "unit_duplicate.png",
        size: 500,
        mediaType: "image" as const,
        width: 100,
        height: 100,
      };

      // Mock selectMediaBySourceIdAndFilePath to return an existing media
      vi.mocked(db.select().from().where).mockResolvedValueOnce([
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
      const sourceId = "b0000000-0000-0000-0000-000000000000";
      const mediaId = "mock-uuid-123";
      const result = await getMedia(sourceId, mediaId);

      expect(db.select).toHaveBeenCalledWith();
      expect(db.select().from).toHaveBeenCalledWith(medias);
      expect(db.select().from().where).toHaveBeenCalledWith(
        eq(medias.id, mediaId)
      );
      expect(result).toBeDefined();
      expect(result.id).toBe(mediaId);
    });

    it("should throw an error if media ID is not found", async () => {
      vi.mocked(db.select().from().where).mockResolvedValueOnce([]);
      await expect(
        getMedia("b0000000-0000-0000-0000-000000000000", "non-existent")
      ).rejects.toThrow("Media not found");
    });

    it("should throw a ZodError for invalid media ID format", async () => {
      await expect(
        getMedia("b0000000-0000-0000-0000-000000000000", "invalid-format")
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
      const sourceId = "b0000000-0000-0000-0000-000000000000";
      const mediaId = "mock-uuid-123";
      const updates = { fileName: "new_name.png", width: 150 };
      const result = await updateMedia(sourceId, mediaId, updates);

      expect(db.update).toHaveBeenCalledWith(medias);
      expect(db.update().set).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: updates.fileName,
          width: updates.width,
        })
      );
      expect(db.update().set().where).toHaveBeenCalledWith(
        eq(medias.id, mediaId)
      );
      expect(result).toBeDefined();
      expect(result.fileName).toBe(updates.fileName);
    });

    it("should throw an error if media ID is not found", async () => {
      vi.mocked(db.update().set().where).mockResolvedValueOnce([]);
      await expect(
        updateMedia("b0000000-0000-0000-0000-000000000000", "non-existent", {
          fileName: "test",
        })
      ).rejects.toThrow("Media not found or failed to update");
    });

    it("should throw a ZodError if no updates are provided", async () => {
      await expect(
        updateMedia("b0000000-0000-0000-0000-000000000000", "mock-uuid-123", {})
      ).rejects.toThrow(ZodError);
    });

    it("should throw a ZodError for invalid update data", async () => {
      const sourceId = "b0000000-0000-0000-0000-000000000000";
      const mediaId = "mock-uuid-123";
      const invalidUpdates = { width: -100 }; // Invalid field
      await expect(
        updateMedia(sourceId, mediaId, invalidUpdates as any)
      ).rejects.toThrow(ZodError);
    });

    it("should throw a ZodError for invalid media ID format", async () => {
      const sourceId = "b0000000-0000-0000-0000-000000000000";
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
      const sourceId = "b0000000-0000-0000-0000-000000000000";
      const mediaId = "mock-uuid-123";
      const result = await deleteMedia(sourceId, mediaId);

      expect(db.delete).toHaveBeenCalledWith(medias);
      expect(db.delete().where).toHaveBeenCalledWith(eq(medias.id, mediaId));
      expect(result).toEqual({ success: true });
    });

    it("should throw a ZodError for invalid media ID format", async () => {
      await expect(
        deleteMedia("b0000000-0000-0000-0000-000000000000", "invalid-format")
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
      const sourceId = "b0000000-0000-0000-0000-000000000000";
      const directoryPath = "/mock/directory/";
      const result = await listMedia(sourceId, directoryPath);

      expect(db.select).toHaveBeenCalledWith();
      expect(db.select().from).toHaveBeenCalledWith(medias);
      expect(db.select().from().where).toHaveBeenCalledWith(
        like(medias.filePath, `${directoryPath}%`)
      );
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should throw a ZodError if directory path is empty", async () => {
      await expect(
        listMedia("b0000000-0000-0000-0000-000000000000", "")
      ).rejects.toThrow(ZodError);
    });

    it("should throw a ZodError if source ID is invalid", async () => {
      await expect(
        listMedia("invalid-format", "/mock/directory/")
      ).rejects.toThrow(ZodError);
    });
  });
});
