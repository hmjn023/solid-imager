import { db } from "~/infrastructure/db/index";
import { presets, type NewPreset } from "~/infrastructure/db/schema";
import { ConstraintError, UnknownDbError } from "../errors";

/**
 * Represents a simplified preset object.
 * @property {string} id - The unique identifier of the preset.
 * @property {string} name - The name of the preset.
 */
type Preset = {
  id: string;
  name: string;
};

/**
 * Selects all presets from the database.
 * @returns {Promise<Preset[]>} A promise that resolves with an array of preset objects.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
export const selectPresets = async () => {
  try {
    return await db.select().from(presets);
  } catch (error) {
    throw new UnknownDbError({ message: String(error) });
  }
};

/**
 * Inserts a new preset into the database.
 * @param {Preset} preset - The preset data to insert.
 * @returns {Promise<Preset[]>} A promise that resolves with an array containing the newly inserted preset.
 * @throws {ConstraintError} If a preset with the same name already exists.
 * @throws {UnknownDbError} If a database error occurs during the insertion.
 */
export const insertPreset = async (preset: NewPreset) => {
  try {
    return await db.insert(presets).values(preset).returning();
  } catch (error: unknown) {
    const cause = (error as { cause?: unknown })?.cause;
    if (
      cause &&
      typeof cause === "object" &&
      "code" in cause &&
      cause.code === "23505"
    ) {
      throw new ConstraintError({ message: "Duplicate entry" });
    }
    throw new UnknownDbError({ message: String(error) });
  }
};
