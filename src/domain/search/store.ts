import { createStore } from "solid-js/store";

export type SearchState = {
  // Filters
  searchQuery: string;
  selectedTags: string[];
  excludeTags: string[];
  tagMode: "and" | "or";
  selectedSource: string;
  selectedProjects: string[];
  selectedIps: string[];
  selectedCharacters: string[];

  // Pagination
  limit: number;
  offset: number;

  // Sorting
  sortBy: "date" | "name" | "size";
  sortOrder: "asc" | "desc";

  // Scroll Position
  scrollY: number;
};

const defaultState: SearchState = {
  searchQuery: "",
  selectedTags: [],
  excludeTags: [],
  tagMode: "and",
  selectedSource: "",
  selectedProjects: [],
  selectedIps: [],
  selectedCharacters: [],
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
