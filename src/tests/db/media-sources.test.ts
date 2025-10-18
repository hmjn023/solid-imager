import { Context, Effect, Layer } from "effect";
import { pipe } from "effect/Function";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseService } from "~/infrastructure/db/layer";
import { selectMediaSources } from "~/infrastructure/db/media-sources";
import { db } from "~/tests/setup"; // Import the mocked db

// Create a mock DatabaseService Layer
const MockDatabaseLive = Layer.succeed(
  DatabaseService,
  Context.make(DatabaseService, { db: db as any })
);

describe("selectMediaSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return an empty array on success", async () => {
    (db.select as vi.Mock).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        execute: vi.fn().mockResolvedValueOnce([]),
      }),
    });
    const result = await Effect.runPromise(
      pipe(selectMediaSources(), Layer.provide(MockDatabaseLive))
    );
    expect(result).toEqual([]);
    expect(db.select).toHaveBeenCalled();
  });
});
