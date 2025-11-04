import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { ConstraintError } from "~/infrastructure/db/errors";
import {
  insertPreset,
  selectPresets,
} from "~/infrastructure/db/queries/presets";
import { presets, type NewPreset } from "~/infrastructure/db/schema";

describe("Preset DB Operations", () => {
  const preset1: NewPreset = {
    name: "Preset 1",
    value: "{}",
  };

  beforeAll(async () => {
    await db.delete(presets).where(sql`true`);
    await db.insert(presets).values(preset1);
  });

  afterAll(async () => {
    await db.delete(presets).where(sql`true`);
  });

  it("selectPresets should return a list of presets on success", async () => {
    const result = await selectPresets();
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe(preset1.name);
  });

  it("insertPreset should insert a new preset on success", async () => {
    const newPreset: NewPreset = {
      name: "Preset 2",
      value: "{}",
    };
    const result = await insertPreset(newPreset);
    expect(result).toBeInstanceOf(Array);
    expect(result[0].name).toBe(newPreset.name);
  });

  it("insertPreset should return ConstraintError on duplicate entry", async () => {
    await expect(insertPreset(preset1)).rejects.toBeInstanceOf(ConstraintError);
  });
});
