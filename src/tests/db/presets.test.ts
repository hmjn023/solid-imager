import { Effect, Layer } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConstraintError, UnknownDbError } from "~/infrastructure/db/errors";
import { DatabaseService } from "~/infrastructure/db/layer";
import { insertPreset, selectPresets } from "~/infrastructure/db/presets";
import { db } from "~/tests/setup"; // Import the mocked db

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
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValueOnce([preset1]),
      }),
    };
    const MockDatabaseLive = Layer.succeed(DatabaseService, {
      db: mockDb as any,
    });
    const result = await Effect.runPromise(
      Effect.provide(selectPresets(), MockDatabaseLive)
    );
    expect(result).toEqual([preset1]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("insertPreset should insert a new preset on success", async () => {
    const newPreset = { id: "preset2", name: "Preset 2" };
    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValueOnce([newPreset]),
      }),
    };
    const MockDatabaseLive = Layer.succeed(DatabaseService, {
      db: mockDb as any,
    });
    const result = await Effect.runPromise(
      Effect.provide(insertPreset(newPreset), MockDatabaseLive)
    );
    expect(result).toEqual([newPreset]);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("insertPreset should return ConstraintError on duplicate entry", async () => {
    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValueOnce({ code: "23505" }),
      }),
    };
    const MockDatabaseLive = Layer.succeed(DatabaseService, {
      db: mockDb as any,
    });
    const result = await Effect.runPromiseExit(
      Effect.provide(
        insertPreset({ id: "preset2", name: "Preset 2" }),
        MockDatabaseLive
      )
    );
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(ConstraintError);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("insertPreset should return UnknownDbError on failure", async () => {
    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValueOnce(new Error("DB error")),
      }),
    };
    const MockDatabaseLive = Layer.succeed(DatabaseService, {
      db: mockDb as any,
    });
    const result = await Effect.runPromiseExit(
      Effect.provide(
        insertPreset({ id: "preset2", name: "Preset 2" }),
        MockDatabaseLive
      )
    );
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.insert).toHaveBeenCalled();
  });
});
