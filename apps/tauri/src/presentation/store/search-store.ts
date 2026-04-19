import type { Preset } from "@solid-imager/core/domain/media/schemas";
import {
	calculateNextModeState,
	getSearchConditionFromState,
	preparePresetState,
} from "@solid-imager/core/domain/search/logic";
import { defaultState, type SearchState } from "@solid-imager/core/domain/search/schema";
import { createStore } from "solid-js/store";

export const [searchState, setSearchState] = createStore<SearchState>({
	...defaultState,
});

export const resetSearchState = () => {
	setSearchState({ ...defaultState });
};

export const clearPresetFilters = () => {
	setSearchState((prev) => ({
		...defaultState,
		mode: prev.mode,
		selectedSource: prev.selectedSource,
		sortBy: prev.sortBy,
		sortOrder: prev.sortOrder,
		tagMode: prev.tagMode,
	}));
};

export const loadPreset = (preset: Preset) => {
	const nextState = preparePresetState(preset, searchState);
	setSearchState(nextState);
};

export const setSearchMode = (mode: "simple" | "pro") => {
	const nextState = calculateNextModeState(searchState, mode);
	setSearchState(nextState);
};

export const getSearchCondition = () => getSearchConditionFromState(searchState);
