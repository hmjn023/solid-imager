import type { Preset } from "@solid-imager/core/presets";
import {
	type SimilarityModel,
	calculateNextModeState,
	encodeSearchSession,
	getSearchConditionFromState,
	preparePresetState,
	defaultState,
	DEFAULT_SIMILARITY_TOP_K,
	type SearchState,
} from "@solid-imager/core/search";
import { batch, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { getSearchStateStorageKey, getSessionStorage } from "../ui-storage";

export const [searchState, setSearchState] = createStore<SearchState>({
	...defaultState,
});

// A global Find Similar action supersedes the source view that initiated it.
// This is a view-lifetime epoch, not persisted search state or another search mode.
const [globalSimilarityActivation, setGlobalSimilarityActivation] =
	createSignal(0);
export const getGlobalSimilarityActivation = globalSimilarityActivation;
const [searchFiltersRevision, setSearchFiltersRevision] = createSignal(0);
export const getSearchFiltersRevision = searchFiltersRevision;

export const resetSearchState = () => {
	setSearchState({ ...defaultState });
};

export const clearPresetFilters = () => {
	setSearchFiltersRevision((revision) => revision + 1);
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
	setSearchState({ ...nextState, semanticQuery: "" });
};

export const setSearchMode = (mode: "simple" | "pro") => {
	const nextState = calculateNextModeState(searchState, mode);
	setSearchState(nextState);
};

function persistSearchState(state: SearchState): void {
	const storage = getSessionStorage();
	if (!storage) return;

	storage.setItem(
		getSearchStateStorageKey("current-all"),
		encodeSearchSession(state),
	);
}

/** Opens similarity ordering with its default result cap and resets the viewport. */
export const activateSimilaritySearch = (
	mediaId: string,
	model: SimilarityModel = "ccip",
) => {
	const nextState: SearchState = {
		...searchState,
		similarityAnchorMediaId: mediaId,
		similarityModel: model,
		semanticQuery: "",
		similarityTopK: DEFAULT_SIMILARITY_TOP_K,
		selectedSource: "",
		offset: 0,
		scrollY: 0,
	};
	batch(() => {
		setGlobalSimilarityActivation((current) => current + 1);
		setSearchState(nextState);
	});
	try {
		persistSearchState(nextState);
	} catch {
		// Persistence errors must not disrupt opening similarity ordering.
	}
};

export const clearSimilaritySearch = () => {
	const nextState: SearchState = {
		...searchState,
		similarityAnchorMediaId: null,
		semanticQuery: "",
		offset: 0,
		scrollY: 0,
	};
	setSearchState(nextState);
	try {
		persistSearchState(nextState);
	} catch {
		// Persistence errors must not disrupt clearing similarity ordering.
	}
};

export const getSearchCondition = () =>
	getSearchConditionFromState(searchState);

export const hasSearchConditions = () =>
	Boolean(
		getSearchCondition()?.children.length ||
		searchState.similarityAnchorMediaId ||
		searchState.semanticQuery.trim(),
	);
