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

export const setSearchMode = (mode: "simple" | "pro" | "vector") => {
	const nextState = calculateNextModeState(searchState, mode);
	setSearchState(nextState);
};

export const activateVectorSearch = (
	mediaId: string,
	options: SearchStorePersistenceOptions = {},
) => {
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
		const storageKey = getSearchStateStorageKey(options.surface ?? "legacy");
		sessionStorage.setItem(
			storageKey,
			JSON.stringify({
				mode: nextState.mode,
				similarityAnchorMediaId: nextState.similarityAnchorMediaId,
				similarityTopK: nextState.similarityTopK,
			}),
		);
	}
};

export const clearVectorSearchAnchor = (
	options: SearchStorePersistenceOptions = {},
) => {
	setSearchState({
		similarityAnchorMediaId: null,
		offset: 0,
		scrollY: 0,
	});
	if (typeof sessionStorage !== "undefined") {
		const storageKey = getSearchStateStorageKey(options.surface ?? "legacy");
		const stored = sessionStorage.getItem(storageKey);
		if (!stored) return;
		try {
			const current: unknown = JSON.parse(stored);
			if (typeof current !== "object" || current === null) {
				sessionStorage.removeItem(storageKey);
				return;
			}
			sessionStorage.setItem(
				storageKey,
				JSON.stringify({
					...current,
					similarityAnchorMediaId: null,
				}),
			);
		} catch {
			sessionStorage.removeItem(storageKey);
		}
	}
};

export const getSearchCondition = () =>
	getSearchConditionFromState(searchState);
