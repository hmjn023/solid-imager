import { Effect, Layer } from "effect";
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
import { DatabaseService } from "~/infrastructure/db/layer";
import {
  selectMediaById,
  selectMediaBySourceIdAndFilePath,
} from "~/infrastructure/db/media";

vi.mock("~/infrastructure/db/media", () => ({
  selectMediaById: vi.fn(),
  selectMediaBySourceIdAndFilePath: vi.fn(),
  insertMedia: vi.fn(),
  updateMedia: vi.fn(),
  deleteMedia: vi.fn(),
  selectMediaBySourceIdAndDirectoryPath: vi.fn(),
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
    selectMediaBySourceIdAndFilePath.mockImplementation((srcId, filePath) => {
      if (srcId === sourceId && filePath === existingMedia.filePath) {
        return Effect.succeed([existingMedia]);
      }
      return Effect.succeed([]);
    });

    selectMediaById.mockImplementation((id) => {
      if (id === mediaId) {
        return Effect.succeed([existingMedia]);
      }
      return Effect.succeed([]);
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

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValueOnce([
            {
              id: uuidv4(),
              ...newMediaData,
              createdAt: new Date(),
              modifiedAt: new Date(),
              indexedAt: new Date(),
            },
          ]),
        }),
      };
      const MockDatabaseLive = Layer.succeed(DatabaseService, {
        db: mockDb as any,
      });

      const result = await Effect.runPromise(
        Effect.provide(addMedia(newMediaData), MockDatabaseLive)
      );

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.fileName).toBe(newMediaData.fileName);
    });

    it("should throw a ZodError if required fields are missing", async () => {
      const invalidData = { filePath: "/path" };
      const effect = addMedia(invalidData as any);
      const exit = await Effect.runPromiseExit(effect);
      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        expect(Effect.Cause.failureOption(exit.cause)).pipe(Effect.Option.map((e) => expect(e).toBeInstanceOf(ZodError)));
      }
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

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([newMediaData]),
        }),
      };
      const MockDatabaseLive = Layer.succeed(DatabaseService, {
        db: mockDb as any,
      });

      const effect = addMedia(newMediaData);
      const exit = await Effect.runPromiseExit(
        Effect.provide(effect, MockDatabaseLive)
      );

      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {

        expect(Effect.Cause.failureOption(exit.cause)).pipe(Effect.Option.map((e) => expect(e).toBeInstanceOf(Error).and.satisfy((err: Error) => err.message === $1)));
      }
    });
  });

  describe("getMedia", () => {
    it("should retrieve a media entry by ID", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const mediaId = "a0000000-0000-4000-8000-000000000000";

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValueOnce([
            {
              id: mediaId,
              sourceId,
              /* other fields */
            },
          ]),
        }),
      };
      const MockDatabaseLive = Layer.succeed(DatabaseService, {
        db: mockDb as any,
      });

      const result = await Effect.runPromise(
        Effect.provide(getMedia(sourceId, mediaId), MockDatabaseLive)
      );

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe(mediaId);
    });

    it("should throw an error if media ID is not found", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const nonExistentMediaId = uuidv4();

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        }),
      };
      const MockDatabaseLive = Layer.succeed(DatabaseService, {
        db: mockDb as any,
      });

      const effect = getMedia(sourceId, nonExistentMediaId);
      const exit = await Effect.runPromiseExit(
        Effect.provide(effect, MockDatabaseLive)
      );

      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {

        expect(Effect.Cause.failureOption(exit.cause)).pipe(Effect.Option.map((e) => expect(e).toBeInstanceOf(Error).and.satisfy((err: Error) => err.message === $1)));
      }
    });

        expect(Effect.Cause.failureOption(exit.cause)).pipe(Effect.Option.map((e) => expect(e).toBeInstanceOf(ZodError)));

    it("should throw a ZodError for invalid source ID format", async () => {
      const effect = getMedia("invalid-format", "mock-uuid-123");
      const exit = await Effect.runPromiseExit(effect);
      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        expect(Effect.Cause.failureOption(exit.cause)).pipe(Effect.Option.map((e) => expect(e).toBeInstanceOf(ZodError)));
      }
    });
  });

  describe("updateMedia", () => {
    it("should update a media entry and return the updated entry", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const mediaId = "a0000000-0000-4000-8000-000000000000";
      const updates = { fileName: "updated_file.png", width: 1024 };

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValueOnce([
            {
              id: mediaId,
              sourceId,
              /* other fields */
            },
          ]),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValueOnce([
            {
              id: mediaId,
              sourceId,
              fileName: updates.fileName,
              width: updates.width,
              /* other fields */
            },
          ]),
        }),
      };
      const MockDatabaseLive = Layer.succeed(DatabaseService, {
        db: mockDb as any,
      });

      const result = await Effect.runPromise(
        Effect.provide(
          updateMedia(sourceId, mediaId, updates),
          MockDatabaseLive
        )
      );

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.fileName).toBe(updates.fileName);
    });

    it("should throw a ZodError for invalid update data", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const mediaId = "a0000000-0000-4000-8000-000000000000";
      const invalidUpdates = { width: -100 }; // Invalid field
      const effect = updateMedia(sourceId, mediaId, invalidUpdates as any);
      const exit = await Effect.runPromiseExit(effect);
      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        expect(Effect.Cause.failureOption(exit.cause)).pipe(Effect.Option.map((e) => expect(e).toBeInstanceOf(ZodError)));
      }
    });

    it("should throw a ZodError for invalid media ID format", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const mediaId = "invalid-format";
      const updates = { fileName: "test" };
      const effect = updateMedia(sourceId, mediaId, updates);
      const exit = await Effect.runPromiseExit(effect);
      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        expect(Effect.Cause.failureOption(exit.cause)).pipe(Effect.Option.map((e) => expect(e).toBeInstanceOf(ZodError)));
      }
    });

    it("should throw a ZodError for invalid source ID format", async () => {
      const sourceId = "invalid-format";
      const mediaId = "mock-uuid-123";
      const updates = { fileName: "test" };
      const effect = updateMedia(sourceId, mediaId, updates);
      const exit = await Effect.runPromiseExit(effect);
      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        expect(Effect.Cause.failureOption(exit.cause)).pipe(Effect.Option.map((e) => expect(e).toBeInstanceOf(ZodError)));
      }
    });
  });

  describe("deleteMedia", () => {
    it("should delete a media entry and return success", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const mediaId = "a0000000-0000-4000-8000-000000000000";

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValueOnce([
            {
              id: mediaId,
              sourceId,
              /* other fields */
            },
          ]),
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValueOnce([
            {
              id: mediaId,
            },
          ]),
        }),
      };
      const MockDatabaseLive = Layer.succeed(DatabaseService, {
        db: mockDb as any,
      });

      const result = await Effect.runPromise(
        Effect.provide(deleteMedia(sourceId, mediaId), MockDatabaseLive)
      );

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.delete).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("should throw a ZodError for invalid media ID format", async () => {
      if (exit._tag === "Failure") {
        expect(Effect.Cause.failureOption(exit.cause)).pipe(Effect.Option.map((e) => expect(e).toBeInstanceOf(ZodError)));
      }
    });

    it("should throw a ZodError for invalid source ID format", async () => {
      if (exit._tag === "Failure") {
        expect(Effect.Cause.failureOption(exit.cause)).pipe(Effect.Option.map((e) => expect(e).toBeInstanceOf(ZodError)));
      }
    });
  });

  describe("listMedia", () => {
    it("should return a list of media entries for a given directory path", async () => {
      const sourceId = "b0000000-0000-4000-8000-000000000000";
      const directoryPath = "/mock/directory/";

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValueOnce([
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
          ]),
        }),
      };
      const MockDatabaseLive = Layer.succeed(DatabaseService, {
        db: mockDb as any,
      });

      const result = await Effect.runPromise(
        Effect.provide(listMedia(sourceId, directoryPath), MockDatabaseLive)
      );

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should throw a ZodError if directory path is empty", async () => {
      const effect = listMedia("665fc9fb-d2b9-49e2-beb3-63cf68fa2b11", "");
      const exit = await Effect.runPromiseExit(effect);
      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        expect(Effect.Cause.failureOption(exit.cause)).pipe(Effect.Option.map((e) => expect(e).toBeInstanceOf(ZodError)));
      }
    });

    it("should throw a ZodError if source ID is invalid", async () => {
      const effect = listMedia("invalid-format", "/mock/directory/");
      const exit = await Effect.runPromiseExit(effect);
      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        expect(Effect.Cause.failureOption(exit.cause)).pipe(Effect.Option.map((e) => expect(e).toBeInstanceOf(ZodError)));
      }
    });
  });
});
