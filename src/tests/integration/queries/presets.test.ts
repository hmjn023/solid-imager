import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import {
  insertPreset,
  selectPresets,
} from "~/infrastructure/db/queries/presets";
import { type NewPreset, presets } from "~/infrastructure/db/schema";

describe("presets queries Integration", () => {
  beforeAll(async () => {
    await db.delete(presets).where(sql`true`);
    const initialPreset: NewPreset = {
      name: "Initial Preset",
      value: { a: 1 },
    };
    await db.insert(presets).values(initialPreset);
  });

  afterAll(async () => {
    await db.delete(presets).where(sql`true`);
  });

  it("should select all presets", async () => {
    const result = await selectPresets();
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("should insert a new preset", async () => {
    const newPreset: NewPreset = { name: "New Test Preset", value: { b: 2 } };
    const inserted = await insertPreset(newPreset);
    expect(inserted).toBeDefined();
    expect(inserted[0].name).toBe(newPreset.name);
  });
});
