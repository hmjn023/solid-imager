import { createEffect, onMount } from "solid-js";
import {
  getSearchCondition,
  loadPreset,
  searchState,
} from "~/domain/search/store";
import { PresetClient } from "~/infrastructure/api/clients/preset-client";
import { logger } from "~/infrastructure/logger";

const DEBOUNCE_MS = 1000;
const CURRENT_PRESET_NAME = "current";

export function useCurrentSearchPersistence() {
  let isInitialLoad = true;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    const init = async () => {
      try {
        const current = await PresetClient.getByName(CURRENT_PRESET_NAME);
        if (current) {
          logger.info(`[AutoSave] Loaded current state: ${current.name}`);
          loadPreset(current);
        } else {
          logger.info("[AutoSave] No current state found, creating default");
          // Create initial "current" preset with empty/default state
          await PresetClient.create({
            name: CURRENT_PRESET_NAME,
            value: { type: "group", operator: "and", children: [] }, // Default empty group
          });
        }
      } catch (e) {
        logger.error(`[AutoSave] Failed to load current state: ${String(e)}`);
      } finally {
        isInitialLoad = false;
      }
    };
    init();
  });

  createEffect(() => {
    // Track dependencies
    // We strictly track the resulting search condition from the store
    // However, getSearchCondition() might return undefined if empty, or specific structure.
    // We want to save *whenever the effective search condition changes*.
    // Note: accessing searchState.* properties here tracks them.
    const _track = [
      searchState.mode,
      searchState.searchQuery,
      searchState.selectedTags,
      searchState.excludeTags,
      searchState.selectedProjects,
      searchState.selectedIps,
      searchState.selectedCharacters,
      searchState.advancedCondition,
      searchState.sortBy, // Sort is part of state but maybe not "value" in preset?
      // Preset schema says 'value' is MediaSearchRequest... verifying schema.
      // Wait, MediaSearchRequest usually includes sort/limit/offset too?
      // Let's check schemas.ts. Preset.value is SearchGroup.
      // If Preset.value is ONLY SearchGroup (filtering), then Sort/Limit might NOT be saved in Preset.
      // The spec said "MediaSearchRequest" which includes sort?
      // Docs said: "value: jsonb("value").notNull()" and "MediaSearchRequest".
      // But implementation of PresetRepository uses `row.value as SearchGroup`.
      // If it is SearchGroup, it only saves component filters.
      // Let's check `src/domain/media/schemas.ts` to be sure.
    ];

    if (isInitialLoad) {
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(saveCurrentState, DEBOUNCE_MS);
  });

  const saveCurrentState = async () => {
    // If condition is undefined (empty), save an empty group to represent "All"
    const condition = getSearchCondition() || {
      type: "group",
      operator: "and",
      children: [],
    };

    try {
      // We need ID to update.
      // Optimization: Cache ID? Or just getByName every time?
      // getByName is safer for race conditions across tabs (though minimal risk for "current").
      const current = await PresetClient.getByName(CURRENT_PRESET_NAME);
      if (current) {
        await PresetClient.update(current.id, { value: condition });
        // logger.info("[AutoSave] Saved current state");
      } else {
        await PresetClient.create({
          name: CURRENT_PRESET_NAME,
          value: condition,
        });
      }
    } catch (e) {
      logger.warn(`[AutoSave] Failed to save state: ${String(e)}`);
    }
  };
}
