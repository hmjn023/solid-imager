/**
 * FilterPresetService - フィルタ・プリセット機能
 * Feature 20: フィルタ・プリセット機能
 */
import { db } from "~/infrastructure/db";
import { type Preset, presets } from "~/infrastructure/db/schema";

/**
 * Provides services for managing filter presets.
 */
export const FilterPresetService = {
  /**
   * Retrieves all saved filter presets.
   * @returns {Promise<Preset[]>} A list of all filter presets.
   */
  async getPresets(): Promise<Preset[]> {
    return db.select().from(presets).orderBy(presets.createdAt);
  },

  /**
   * Saves a new search filter preset.
   * @param {object} presetData - The data for the preset.
   * @param {string} presetData.name - The name of the preset.
   * @param {unknown} presetData.conditions - The search conditions to save.
   * @returns {Promise<Preset>} The newly saved preset.
   */
  async savePreset(presetData: {
    name: string;
    conditions: unknown;
  }): Promise<Preset> {
    const [savedPreset] = await db
      .insert(presets)
      .values({
        name: presetData.name,
        value: presetData.conditions,
      })
      .returning();
    return savedPreset;
  },
};
