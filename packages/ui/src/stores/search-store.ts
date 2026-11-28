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
import { createSignal } from "solid-js";
import { createStore } from "solid-js";
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
	setSearchState((draft) => {
		Object.assign(draft, { ...defaultState });
	});
};

export const clearPresetFilters = () => {
	setSearchFiltersRevision((revision) => revision + 1);
	setSearchState((prev) => {
		Object.assign(prev, {
			...defaultState,
			mode: prev.mode,
			selectedSource: prev.selectedSource,
			sortBy: prev.sortBy,
			sortOrder: prev.sortOrder,
			tagMode: prev.tagMode,
		});
	});
};

export const loadPreset = (preset: Preset) => {
	const nextState = preparePresetState(preset, searchState);
	setSearchState((draft) => {
		Object.assign(draft, { ...nextState, semanticQuery: "" });
	});
};

export const setSearchMode = (mode: "simple" | "pro") => {
	const nextState = calculateNextModeState(searchState, mode);
	setSearchState((draft) => {
		Object.assign(draft, nextState);
	});
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
	{
		setGlobalSimilarityActivation((current) => current + 1);
		setSearchState((draft) => {
			Object.assign(draft, nextState);
		});
	}
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
	setSearchState((draft) => {
		Object.assign(draft, nextState);
	});
	try {
		persistSearchState(nextState);
	} catch {
		// Persistence errors must not disrupt clearing similarity ordering.
	}
};

/** Opens simple tag search filtered to a single tag and resets the viewport. */
export const activateTagSearch = (tagName: string) => {
	const nextState: SearchState = {
		...defaultState,
		mode: "simple",
		selectedTags: [tagName],
		sortBy: searchState.sortBy,
		sortOrder: searchState.sortOrder,
		limit: searchState.limit,
		tagMode: searchState.tagMode,
	};
	{
		setSearchFiltersRevision((revision) => revision + 1);
		setSearchState((draft) => {
			Object.assign(draft, nextState);
		});
	}
	try {
		persistSearchState(nextState);
	} catch {
		// Persistence errors must not disrupt opening tag search.
	}
};

export const getSearchCondition = () =>
	getSearchConditionFromState(searchState);

export const hasSearchConditions = (state = searchState) =>
	Boolean(
		getSearchConditionFromState(state)?.children.length ||
		state.similarityAnchorMediaId ||
		state.semanticQuery.trim(),
	);
