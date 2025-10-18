import { Context, Effect, Layer } from "effect";
import { pipe } from "effect/Function";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConstraintError, UnknownDbError } from "~/infrastructure/db/errors";
import { DatabaseService } from "~/infrastructure/db/layer";
import { insertPreset, selectPresets } from "~/infrastructure/db/presets";
import { db } from "~/tests/setup"; // Import the mocked db

// Create a mock DatabaseService Layer
const MockDatabaseLive = Layer.succeed(
  DatabaseService,
  Context.make(DatabaseService, { db: db as any })
);

describe("Preset Database Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as vi.Mock).mockClear();
    (db.insert as vi.Mock).mockClear();
    (db.update as vi.Mock).mockClear();
    (db.query.mediaSources.findFirst as vi.Mock).mockClear();
    (db.transaction as vi.Mock).mockClear();
  });

  it("selectPresets should return a list of presets on success", async () => {
    const preset1 = { id: "preset1", name: "Preset 1" };
    (db.select as vi.Mock).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        execute: vi.fn().mockResolvedValueOnce([preset1]),
      }),
    });
    const result = await Effect.runPromise(
      pipe(selectPresets(), Layer.provide(MockDatabaseLive))
    );
    expect(result).toEqual([preset1]);
    expect(db.select).toHaveBeenCalled();
  });

  it("insertPreset should insert a new preset on success", async () => {
    const newPreset = { id: "preset2", name: "Preset 2" };
    (db.insert as vi.Mock).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([newPreset]),
      }),
    });
    const result = await Effect.runPromise(
      pipe(insertPreset(newPreset), Layer.provide(MockDatabaseLive))
    );
    expect(result).toEqual([newPreset]);
    expect(db.insert).toHaveBeenCalled();
  });

  it("insertPreset should return ConstraintError on duplicate entry", async () => {
    (db.insert as vi.Mock).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockRejectedValueOnce({ code: "23505" }),
      }),
    });
    const result = await Effect.runPromiseExit(
      pipe(
        insertPreset({ id: "preset2", name: "Preset 2" }),
        Layer.provide(MockDatabaseLive)
      )
    );
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(ConstraintError);
    expect(db.insert).toHaveBeenCalled();
  });

  it("insertPreset should return UnknownDbError on failure", async () => {
    (db.insert as vi.Mock).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockRejectedValueOnce(new Error("DB error")),
      }),
    });
    const result = await Effect.runPromiseExit(
      pipe(
        insertPreset({ id: "preset2", name: "Preset 2" }),
        Layer.provide(MockDatabaseLive)
      )
    );
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(db.insert).toHaveBeenCalled();
  });
});
