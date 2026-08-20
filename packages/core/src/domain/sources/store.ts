import { createStore } from "solid-js/store";

export type SourcesState = {
	// Map of mediaSourceId to scrollY position
	scrollPositions: Record<string, number>;
};

const defaultState: SourcesState = {
	scrollPositions: {},
};

const STORAGE_KEY = "solid-imager-scroll-positions";
const canUseSessionStorage = typeof sessionStorage !== "undefined";

// Initialize state from sessionStorage if available
const getInitialState = (): SourcesState => {
	if (!canUseSessionStorage) {
		return defaultState;
	}
	try {
		const stored = sessionStorage.getItem(STORAGE_KEY);
		return stored ? JSON.parse(stored) : defaultState;
	} catch {
		return defaultState;
	}
};

export const [sourcesState, setSourcesState] = createStore<SourcesState>(
	getInitialState(),
);

// Helper to persist to sessionStorage
const persistToStorage = () => {
	if (!canUseSessionStorage) {
		return;
	}
	const data = JSON.stringify(sourcesState);
	sessionStorage.setItem(STORAGE_KEY, data);
};

function getScrollKey(mediaSourceId: string, historyEntryKey?: string): string {
	return historyEntryKey
		? `${mediaSourceId}::history:${historyEntryKey}`
		: mediaSourceId;
}

export const getScrollPosition = (
	mediaSourceId: string,
	historyEntryKey?: string,
) => {
	const position =
		sourcesState.scrollPositions[
			getScrollKey(mediaSourceId, historyEntryKey)
		] || 0;
	return position;
};

export const setScrollPosition = (
	mediaSourceId: string,
	scrollY: number,
	historyEntryKey?: string,
) => {
	setSourcesState(
		"scrollPositions",
		getScrollKey(mediaSourceId, historyEntryKey),
		scrollY,
	);
	// Persist immediately after updating
	persistToStorage();
};
