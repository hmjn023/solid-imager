import type { Preset } from "@solid-imager/core/domain/media/schemas";
import {
	calculateNextModeState,
	getSearchConditionFromState,
	preparePresetState,
} from "@solid-imager/core/domain/search/logic";
import {
	defaultState,
	type SearchState,
} from "@solid-imager/core/domain/search/schema";
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

export const setSearchMode = (mode: "simple" | "pro" | "vector") => {
	const nextState = calculateNextModeState(searchState, mode);
	setSearchState(nextState);
};

export const activateVectorSearch = (mediaId: string) => {
	const nextState = {
		mode: "vector" as const,
		similarityAnchorMediaId: mediaId,
		similarityTopK: 50 as const,
		selectedSource: "",
		offset: 0,
		scrollY: 0,
	};
	setSearchState(nextState);
	if (typeof sessionStorage !== "undefined") {
		sessionStorage.setItem(
			"current-all",
			JSON.stringify({
				mode: nextState.mode,
				similarityAnchorMediaId: nextState.similarityAnchorMediaId,
				similarityTopK: nextState.similarityTopK,
			}),
		);
	}
};

export const clearVectorSearchAnchor = () => {
	setSearchState({
		similarityAnchorMediaId: null,
		offset: 0,
		scrollY: 0,
	});
};

export const getSearchCondition = () =>
	getSearchConditionFromState(searchState);
