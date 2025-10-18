import { Context, Effect, Layer } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseService } from "~/infrastructure/db/layer";
import { selectMediaSources } from "~/infrastructure/db/media-sources";
import { db } from "~/tests/setup"; // Import the mocked db

// Create a mock DatabaseService Layer
const _MockDatabaseLive = Layer.succeed(
  DatabaseService,
  Context.make(DatabaseService, { db: db as any })
);

describe("selectMediaSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return an empty array on success", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValueOnce([]),
      }),
    };
    const MockDatabaseLive = Layer.succeed(
      DatabaseService,
      Context.make(DatabaseService, { db: mockDb as any })
    );

    const result = await Effect.runPromise(
      Effect.provide(selectMediaSources(), MockDatabaseLive)
    );
    expect(result).toEqual([]);
    expect(mockDb.select).toHaveBeenCalled();
  });
});
