import { Context, Effect, Layer } from "effect";
import { pipe } from "effect/Function";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, UnknownDbError } from "~/infrastructure/db/errors";
import { DatabaseService } from "~/infrastructure/db/layer";
import { selectRandomMedia } from "~/infrastructure/db/media-random";
import { db } from "~/tests/setup"; // Import the mocked db

// Create a mock DatabaseService Layer
const MockDatabaseLive = Layer.succeed(
  DatabaseService,
  Context.make(DatabaseService, { db: db as any })
);

describe("selectRandomMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as vi.Mock).mockClear();
    (db.insert as vi.Mock).mockClear();
    (db.update as vi.Mock).mockClear();
    (db.delete as vi.Mock).mockClear();
    (db.query.mediaSources.findFirst as vi.Mock).mockClear();
    (db.transaction as vi.Mock).mockClear();
  });

  it("should return a random media item on success", async () => {
    const media1 = { id: "media1", sourceId: "source1", createdAt: new Date() };
    (db.select as vi.Mock).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          orderBy: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([media1]),
          }),
        }),
      }),
    });
    const result = await Effect.runPromise(
      pipe(selectRandomMedia("source1"), Layer.provide(MockDatabaseLive))
    );
    expect(result).toEqual(media1);
    expect(db.select).toHaveBeenCalled();
  });

  it("should return NotFoundError if no random media found", async () => {
    (db.select as vi.Mock).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          orderBy: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      }),
    });
    const result = await Effect.runPromiseExit(
      pipe(selectRandomMedia("source1"), Layer.provide(MockDatabaseLive))
    );
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(db.select).toHaveBeenCalled();
  });

  it("should return UnknownDbError on failure", async () => {
    (db.select as vi.Mock).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          orderBy: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockRejectedValueOnce(new Error("DB error")),
          }),
        }),
      }),
    });
    const result = await Effect.runPromiseExit(
      pipe(selectRandomMedia("source1"), Layer.provide(MockDatabaseLive))
    );
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(db.select).toHaveBeenCalled();
  });
});
