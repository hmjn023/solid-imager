/// <reference types="vitest/globals" />
import { Effect, Layer } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnknownDbError } from "~/infrastructure/db/errors";
import { DatabaseService } from "~/infrastructure/db/layer";
import { selectRecentMedia } from "~/infrastructure/db/media-recent";
import { db } from "~/tests/setup"; // Import the mocked db

describe("selectRecentMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as vi.Mock).mockClear();
    (db.insert as vi.Mock).mockClear();
    (db.update as vi.Mock).mockClear();
    (db.delete as vi.Mock).mockClear();
    (db.query.mediaSources.findFirst as vi.Mock).mockClear();
    (db.transaction as vi.Mock).mockClear();
  });

  it("should return a list of recent media on success", async () => {
    const media1 = { id: "media1", sourceId: "source1", createdAt: new Date() };
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([media1]),
      }),
    };
    const MockDatabaseLive = Layer.succeed(DatabaseService, {
      db: mockDb as any,
    });
    const result = await Effect.runPromise(
      Effect.provide(selectRecentMedia("source1"), MockDatabaseLive)
    );
    expect(result).toEqual([media1]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("should return UnknownDbError on failure", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValueOnce(new Error("DB error")),
      }),
    };
    const MockDatabaseLive = Layer.succeed(DatabaseService, {
      db: mockDb as any,
    });
    const result = await Effect.runPromiseExit(
      Effect.provide(selectRecentMedia("source1"), MockDatabaseLive)
    );
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });
});
