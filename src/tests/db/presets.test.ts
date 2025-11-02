import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConstraintError, UnknownDbError } from "~/infrastructure/db/errors";
import {
  insertPreset,
  selectPresets,
} from "~/infrastructure/db/queries/presets";
import { db } from "~/infrastructure/db/index"; // Import the mocked db

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
    (db.select as vi.Mock).mockReturnValue({
      from: vi.fn().mockResolvedValueOnce([preset1]),
    });
    const result = await selectPresets();
    expect(result).toEqual([preset1]);
    expect(db.select).toHaveBeenCalled();
  });

  it("insertPreset should insert a new preset on success", async () => {
    const newPreset = { id: "preset2", name: "Preset 2" };
    (db.insert as vi.Mock).mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValueOnce([newPreset]),
    });
    const result = await insertPreset(newPreset);
    expect(result).toEqual([newPreset]);
    expect(db.insert).toHaveBeenCalled();
  });

  it("insertPreset should return ConstraintError on duplicate entry", async () => {
    (db.insert as vi.Mock).mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi
        .fn()
        .mockRejectedValueOnce({ code: "23505", message: "duplicate key" }),
    });
    await expect(
      insertPreset({ id: "preset2", name: "Preset 2" })
    ).rejects.toBeInstanceOf(ConstraintError);
    expect(db.insert).toHaveBeenCalled();
  });

  it("insertPreset should return UnknownDbError on failure", async () => {
    (db.insert as vi.Mock).mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi
        .fn()
        .mockRejectedValueOnce(new UnknownDbError({ message: "DB error" })),
    });
    await expect(
      insertPreset({ id: "preset2", name: "Preset 2" })
    ).rejects.toBeInstanceOf(UnknownDbError);
    expect(db.insert).toHaveBeenCalled();
  });
});
