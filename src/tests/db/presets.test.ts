import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConstraintError, UnknownDbError } from "~/infrastructure/db/errors";
import { insertPreset, selectPresets } from "~/infrastructure/db/presets";
import { db } from "~/tests/setup"; // Import the mocked db

vi.mock("~/infrastructure/db/presets");

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
    vi.mocked(selectPresets).mockImplementation(async () =>
      mockDb.select().from()
    );
    const result = await selectPresets();
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
    vi.mocked(insertPreset).mockImplementation(async (data) =>
      mockDb.insert().values(data).returning()
    );
    const result = await insertPreset(newPreset);
    expect(result).toEqual([newPreset]);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("insertPreset should return ConstraintError on duplicate entry", async () => {
    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValueOnce(
          new ConstraintError({
            message: "Duplicate entry",
            details: { code: "23505" },
          })
        ),
      }),
    };
    vi.mocked(insertPreset).mockImplementation(async (data) =>
      mockDb.insert().values(data).returning()
    );
    await expect(
      insertPreset({ id: "preset2", name: "Preset 2" })
    ).rejects.toBeInstanceOf(ConstraintError);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("insertPreset should return UnknownDbError on failure", async () => {
    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi
          .fn()
          .mockRejectedValueOnce(new UnknownDbError({ message: "DB error" })),
      }),
    };
    vi.mocked(insertPreset).mockImplementation(async (data) =>
      mockDb.insert().values(data).returning()
    );
    await expect(
      insertPreset({ id: "preset2", name: "Preset 2" })
    ).rejects.toBeInstanceOf(UnknownDbError);
    expect(mockDb.insert).toHaveBeenCalled();
  });
});
