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

export type SearchPersistenceSurface = "legacy" | "v2";

export type SearchStorePersistenceOptions = {
	surface?: SearchPersistenceSurface;
};

function getSearchStateStorageKey(surface: SearchPersistenceSurface): string {
	return surface === "v2" ? "v2:current-all" : "current-all";
}

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

function persistSearchState(
	state: SearchState,
	surface: SearchPersistenceSurface,
): void {
	if (typeof sessionStorage === "undefined") return;

	const condition = getSearchConditionFromState(state) ?? {
		type: "group" as const,
		operator: "and" as const,
		children: [],
	};
	const storageKey = getSearchStateStorageKey(surface);
	sessionStorage.setItem(
		storageKey,
		JSON.stringify({
			value: condition,
			selectedSource: state.selectedSource,
			sort: state.sortBy,
			order: state.sortOrder,
			mode: state.mode,
			similarityAnchorMediaId: state.similarityAnchorMediaId,
			similarityTopK: state.similarityTopK,
		}),
	);
}

export const activateSimilaritySearch = (
	mediaId: string,
	options: SearchStorePersistenceOptions = {},
) => {
	const nextState: SearchState = {
		...searchState,
		similarityAnchorMediaId: mediaId,
		similarityTopK: 50,
		selectedSource: "",
		offset: 0,
		scrollY: 0,
	};
	setSearchState(nextState);
	try {
		persistSearchState(nextState, options.surface ?? "legacy");
	} catch {
		// Persistence errors must not disrupt opening similarity ordering.
	}
};

export const clearSimilaritySearch = (
	options: SearchStorePersistenceOptions = {},
) => {
	const nextState: SearchState = {
		...searchState,
		similarityAnchorMediaId: null,
		offset: 0,
		scrollY: 0,
	};
	setSearchState(nextState);
	try {
		persistSearchState(nextState, options.surface ?? "legacy");
	} catch {
		// Persistence errors must not disrupt clearing similarity ordering.
	}
};

export const getSearchCondition = () =>
	getSearchConditionFromState(searchState);
