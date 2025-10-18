import { Effect, Layer, service } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseService } from "~/infrastructure/db/layer";
import { selectMediaSources } from "~/infrastructure/db/media-sources";

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
    const MockDatabaseLive = Layer.succeed(DatabaseService, {
      db: mockDb as any,
    });

    const result = await Effect.runPromise(
      Effect.provide(selectMediaSources(), MockDatabaseLive)
    );
    expect(result).toEqual([]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("should be able to get the service", async () => {
    const mockDb = {};
    const MockDatabaseLive = Layer.succeed(DatabaseService, {
      db: mockDb as any,
    });
    const effect = Effect.gen(function* (_) {
      const serviceInstance = yield* _(service(DatabaseService));
      return serviceInstance;
    });
    const result = await Effect.runPromise(
      Effect.provide(effect, MockDatabaseLive)
    );
    expect(result.db).toBe(mockDb);
  });
});
