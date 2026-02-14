import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import { PresetClient } from "~/infrastructure/api/clients/preset-client";
import { logger } from "~/infrastructure/logger";
import {
  getSearchCondition,
  loadPreset,
  resetSearchState,
  searchState,
  setSearchState,
} from "~/presentation/store/search-store";

const DEBOUNCE_MS = 1000;

export function useCurrentSearchPersistence(
  sourceId: string | Accessor<string | null | undefined> = "current"
) {
  const [isInitialLoad, setIsInitialLoad] = createSignal(true);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const getCurrentPresetName = () => {
    const id = typeof sourceId === "function" ? sourceId() : sourceId;
    if (id === "current") {
      return "current";
    }
    if (id === "current-all" || id === "all") {
      return "current-all";
    }
    return id ? `current-${id}` : null;
  };

  createEffect(() => {
    const presetName = getCurrentPresetName();
    if (!presetName) {
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const init = async () => {
      setIsInitialLoad(true);

      try {
        const current = await PresetClient.getByName(presetName);
        if (current) {
          logger.info(`[AutoSave] Loaded current state for: ${presetName}`);

          const allPresets = await PresetClient.list();
          const { deepEqual } = await import("~/utils/deep-equal");

          const matchingPreset = allPresets.find(
            (p) => p.name !== presetName && deepEqual(p.value, current.value)
          );

          if (matchingPreset) {
            logger.info(
              `[AutoSave] Found matching preset: ${matchingPreset.name}`
            );
            loadPreset({
              ...matchingPreset,
              mode: current.mode,
              sort: current.sort,
              order: current.order,
            });
          } else {
            loadPreset(current);
            setSearchState("activePresetId", null);
          }
        } else {
          logger.info(`[AutoSave] No current state found for ${presetName}`);
          resetSearchState();
          await PresetClient.create({
            name: presetName,
            value: { type: "group", operator: "and", children: [] },
            mode: "simple",
          });
        }
      } catch (e) {
        logger.error(
          `[AutoSave] Failed to load current state (${presetName}): ${String(e)}`
        );
      } finally {
        setIsInitialLoad(false);
      }
    };
    init();
  });

  createEffect(() => {
    // Track dependencies
    const _track = [
      searchState.mode,
      searchState.selectedSource,
      searchState.searchQuery,
      searchState.selectedTags,
      searchState.excludeTags,
      searchState.tagMode,
      searchState.selectedProjects,
      searchState.selectedIps,
      searchState.selectedCharacters,
      searchState.selectedAuthors,
      searchState.advancedCondition,
      searchState.sortBy,
      searchState.sortOrder,
    ];

    if (isInitialLoad() || !getCurrentPresetName()) {
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(saveCurrentState, DEBOUNCE_MS);
  });

  onCleanup(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  });

  const saveCurrentState = async () => {
    const presetName = getCurrentPresetName();
    if (!presetName) {
      return;
    }

    const condition = getSearchCondition() || {
      type: "group",
      operator: "and",
      children: [],
    };

    const presetData = {
      value: condition,
      selectedSource: searchState.selectedSource,
      sort: searchState.sortBy,
      order: searchState.sortOrder,
      mode: searchState.mode,
    };

    try {
      // We need ID to update.
      // Optimization: Cache ID? Or just getByName every time?
      // getByName is safer for race conditions across tabs (though minimal risk for "current").
      const current = await PresetClient.getByName(presetName);
      if (current) {
        await PresetClient.update(current.id, presetData);
      } else {
        await PresetClient.create({
          name: presetName,
          ...presetData,
        });
      }
    } catch (e) {
      logger.warn(
        `[AutoSave] Failed to save state (${presetName}): ${String(e)}`
      );
    }
  };
}
