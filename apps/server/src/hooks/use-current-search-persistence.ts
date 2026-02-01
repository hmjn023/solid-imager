import { createEffect, onMount } from "solid-js";
import { PresetClient } from "~/infrastructure/api/clients/preset-client";
import { logger } from "~/infrastructure/logger";
import {
  getSearchCondition,
  loadPreset,
  searchState,
  setSearchState,
} from "~/presentation/store/search-store";

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

          // Try to find a matching named preset to restore selection state
          const allPresets = await PresetClient.list();
          // Dynamic import to avoid circular dependencies if any, though utils is safe
          const { deepEqual } = await import("~/utils/deep-equal");

          const matchingPreset = allPresets.find(
            (p) =>
              p.name !== CURRENT_PRESET_NAME &&
              deepEqual(p.value, current.value)
          );

          if (matchingPreset) {
            logger.info(
              `[AutoSave] Found matching preset: ${matchingPreset.name}`
            );
            // Even if we match a named preset, we should prioritize the exact UI state (mode, sort, order)
            // stored in the "current" preset to ensure a perfect restoration.
            loadPreset({
              ...matchingPreset,
              mode: current.mode,
              sort: current.sort,
              order: current.order,
            });
          } else {
            loadPreset(current);
            // current preset itself should not be "selected" in UI, so we might want to clear activePresetId
            // But loadPreset sets activePresetId to current.id.
            // We can manually reset it to null effectively treating it as "unsaved/custom" state
            // preserving the loaded conditions.
            setSearchState("activePresetId", null);
          }
        } else {
          logger.info("[AutoSave] No current state found, creating default");
          // Create initial "current" preset with empty/default state
          await PresetClient.create({
            name: CURRENT_PRESET_NAME,
            value: { type: "group", operator: "and", children: [] },
            mode: "simple",
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
      searchState.sortBy,
      searchState.sortOrder,
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

    const presetData = {
      value: condition,
      sort: searchState.sortBy,
      order: searchState.sortOrder,
      mode: searchState.mode,
    };

    try {
      // We need ID to update.
      // Optimization: Cache ID? Or just getByName every time?
      // getByName is safer for race conditions across tabs (though minimal risk for "current").
      const current = await PresetClient.getByName(CURRENT_PRESET_NAME);
      if (current) {
        await PresetClient.update(current.id, presetData);
        // logger.info("[AutoSave] Saved current state");
      } else {
        await PresetClient.create({
          name: CURRENT_PRESET_NAME,
          ...presetData,
        });
      }
    } catch (e) {
      logger.warn(`[AutoSave] Failed to save state: ${String(e)}`);
    }
  };
}
