import type {
  Preset,
  SearchCriterion,
  SearchGroup,
} from "@/domain/media/schemas";

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

export const defaultState: SearchState = {
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
