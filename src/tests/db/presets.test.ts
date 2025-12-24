import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ConstraintError, UnknownDbError } from "~/infrastructure/db/errors";
import { db } from "~/infrastructure/db/index"; // Import the mocked db
import {
  insertPreset,
  selectPresets,
} from "~/infrastructure/db/queries/presets";

describe("Preset Database Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as Mock).mockClear();
    (db.insert as Mock).mockClear();
    (db.update as Mock).mockClear();
    (db.query.mediaSources.findFirst as Mock).mockClear();
    (db.transaction as Mock).mockClear();
  });

  it("selectPresets should return a list of presets on success", async () => {
    const preset1 = {
      id: 1,
      name: "Preset 1",
      value: {},
      createdAt: new Date(),
    };
    (db.select as Mock).mockReturnValue({
      from: vi.fn().mockResolvedValueOnce([preset1]),
    });
    const result = await selectPresets();
    expect(result).toEqual([preset1]);
    expect(db.select).toHaveBeenCalled();
  });

  it("insertPreset should insert a new preset on success", async () => {
    const newPreset = {
      id: 2,
      name: "Preset 2",
      value: {},
      createdAt: new Date(),
    };
    (db.insert as Mock).mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValueOnce([newPreset]),
    });
    const result = await insertPreset({ name: "Preset 2", value: {} });
    expect(result).toEqual([newPreset]);
    expect(db.insert).toHaveBeenCalled();
  });

  it("insertPreset should return ConstraintError on duplicate entry", async () => {
    (db.insert as Mock).mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi
        .fn()
        .mockRejectedValueOnce({ code: "23505", message: "duplicate key" }),
    });
    await expect(
      insertPreset({ name: "Preset 2", value: {} })
    ).rejects.toBeInstanceOf(ConstraintError);
    expect(db.insert).toHaveBeenCalled();
  });

  it("insertPreset should return UnknownDbError on failure", async () => {
    (db.insert as Mock).mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi
        .fn()
        .mockRejectedValueOnce(new UnknownDbError({ message: "DB error" })),
    });
    await expect(
      insertPreset({ name: "Preset 2", value: {} })
    ).rejects.toBeInstanceOf(UnknownDbError);
    expect(db.insert).toHaveBeenCalled();
  });
});
