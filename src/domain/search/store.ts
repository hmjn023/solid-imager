import { createStore } from "solid-js/store";
import type {
  Preset,
  SearchCriterion,
  SearchGroup,
} from "~/domain/media/schemas";

export type SearchState = {
  // Modes
  mode: "simple" | "pro";
  activePresetId: number | null;

  // Filters (Simple Mode)
  searchQuery: string;
  selectedTags: string[];
  excludeTags: string[];
  tagMode: "and" | "or";
  selectedSource: string;
  selectedProjects: string[];
  selectedIps: string[];
  selectedCharacters: string[];
  selectedAuthors: string[];

  // Filters (Pro Mode)
  advancedCondition: SearchGroup | null;

  // Pagination
  limit: number;
  offset: number;

  // Sorting
  sortBy: "date" | "name" | "size" | "rating" | "viewCount";
  sortOrder: "asc" | "desc";

  // Scroll Position
  scrollY: number;
};

const defaultState: SearchState = {
  mode: "simple",
  activePresetId: null,
  searchQuery: "",
  selectedTags: [],
  excludeTags: [],
  tagMode: "and",
  selectedSource: "",
  selectedProjects: [],
  selectedIps: [],
  selectedCharacters: [],
  selectedAuthors: [],
  advancedCondition: null,
  limit: 20,
  offset: 0,
  sortBy: "date",
  sortOrder: "desc",
  scrollY: 0,
};

export const [searchState, setSearchState] = createStore<SearchState>({
  ...defaultState,
});

export const resetSearchState = () => {
  setSearchState({ ...defaultState });
};

export const loadPreset = (preset: Preset) => {
  const simpleState = restoreFromSearchGroup(preset.value);
  const sortState = {
    sortBy: (preset.sort as SearchState["sortBy"]) || "date",
    sortOrder: (preset.order as SearchState["sortOrder"]) || "desc",
  };

  if (preset.mode) {
    if (preset.mode === "simple" && simpleState) {
      setSearchState({
        mode: "simple",
        activePresetId: preset.id,
        advancedCondition: null,
        ...simpleState,
        ...sortState,
      });
    } else {
      setSearchState({
        mode: "pro",
        activePresetId: preset.id,
        advancedCondition: preset.value,
        // Reset simple filters
        searchQuery: "",
        selectedTags: [],
        excludeTags: [],
        selectedProjects: [],
        selectedIps: [],
        selectedCharacters: [],
        selectedAuthors: [],
        ...sortState,
      });
    }
    return;
  }

  // Fallback for older presets without mode:
  // Respect current mode if the preset can be represented in it,
  // or default to simple if it's a simple-compatible preset and we are in simple mode.
  if (searchState.mode === "pro") {
    setSearchState({
      mode: "pro",
      activePresetId: preset.id,
      advancedCondition: preset.value,
      // No need to reset simple filters as they are not used in pro view,
      // but keeping it clean or syncing might be good.
      ...sortState,
    });
  } else if (simpleState) {
    setSearchState({
      mode: "simple",
      activePresetId: preset.id,
      advancedCondition: null,
      ...simpleState,
      ...sortState,
    });
  } else {
    // If not simple compatible and we are in simple mode, MUST switch to pro
    setSearchState({
      mode: "pro",
      activePresetId: preset.id,
      advancedCondition: preset.value,
      ...sortState,
    });
  }
};

/**
 * Tries to map a SearchGroup back to simple search state.
 * Returns null if the condition cannot be represented in simple mode.
 */
const restoreFromSearchGroup = (
  group: SearchGroup
): Partial<SearchState> | null => {
  // Simple mode is always a top-level AND group
  if (group.operator !== "and") {
    return null;
  }

  const state: Partial<SearchState> = {
    searchQuery: "",
    selectedTags: [],
    excludeTags: [],
    selectedProjects: [],
    selectedIps: [],
    selectedCharacters: [],
    selectedAuthors: [],
    tagMode: "and",
  };

  for (const child of group.children) {
    if (child.type === "group") {
      return null;
    }

    if (!applyCriterionToState(state, child)) {
      return null;
    }
  }

  return state;
};

const applyCriterionToState = (
  state: Partial<SearchState>,
  criterion: SearchCriterion
): boolean => {
  const { target, operator, value, negate } = criterion;

  if (target === "fileName" && operator === "contains" && !negate) {
    state.searchQuery = value as string;
    return true;
  }

  if (operator !== "equals") {
    return false;
  }

  const targetMap: Record<string, string[] | undefined> = {
    tag: negate ? state.excludeTags : state.selectedTags,
    project: negate ? undefined : state.selectedProjects,
    ip: negate ? undefined : state.selectedIps,
    character: negate ? undefined : state.selectedCharacters,
    author: negate ? undefined : state.selectedAuthors,
  };

  const list = targetMap[target];
  if (list) {
    list.push(value as string);
    return true;
  }

  return false;
};

/**
 * Constructs the SearchGroup based on current mode and filters.
 */
export const getSearchCondition = (): SearchGroup | undefined => {
  if (searchState.mode === "pro") {
    return searchState.advancedCondition || undefined;
  }

  // Simple Mode Construction
  const conditions: SearchGroup["children"] = [];

  // Keyword (File name)
  if (searchState.searchQuery.trim()) {
    conditions.push({
      type: "criterion",
      target: "fileName",
      operator: "contains",
      value: searchState.searchQuery.trim(),
    });
  }

  // Helpers to add conditions
  addTagConditions(conditions);
  addFilterConditions(conditions, "project", searchState.selectedProjects);
  addFilterConditions(conditions, "ip", searchState.selectedIps);
  addFilterConditions(conditions, "character", searchState.selectedCharacters);
  addFilterConditions(conditions, "author", searchState.selectedAuthors);

  if (conditions.length === 0) {
    return;
  }

  return {
    type: "group",
    operator: "and",
    children: conditions,
  };
};

const addTagConditions = (conditions: SearchGroup["children"]) => {
  // Tags (Positive)
  if (searchState.selectedTags.length > 0) {
    // Simple mode now always uses AND for tags.
    for (const tag of searchState.selectedTags) {
      conditions.push({
        type: "criterion",
        target: "tag",
        operator: "equals",
        value: tag,
      });
    }
  }

  // Tags (Negative)
  if (searchState.excludeTags.length > 0) {
    for (const tag of searchState.excludeTags) {
      conditions.push({
        type: "criterion",
        target: "tag",
        operator: "equals",
        value: tag,
        negate: true,
      });
    }
  }
};

const addFilterConditions = (
  conditions: SearchGroup["children"],
  target: "project" | "ip" | "character" | "author",
  values: string[]
) => {
  for (const value of values) {
    conditions.push({
      type: "criterion",
      target,
      operator: "equals",
      value,
    });
  }
};
