import { createStore } from "solid-js";
import { z } from "zod";

// Shared browser scroll state for the web and Tauri source pages.
export type SourcesState = {
	// Map of mediaSourceId to scrollY position
	scrollPositions: Record<string, number>;
};

const defaultState: SourcesState = {
	scrollPositions: {},
};

const sourcesStateSchema = z.object({
	scrollPositions: z.record(z.string(), z.number()),
});

const STORAGE_KEY = "solid-imager-scroll-positions";
const canUseSessionStorage = typeof sessionStorage !== "undefined";

// Initialize state from sessionStorage if available
const getInitialState = (): SourcesState => {
	if (!canUseSessionStorage) {
		return defaultState;
	}
	try {
		const stored = sessionStorage.getItem(STORAGE_KEY);
		return stored ? sourcesStateSchema.parse(JSON.parse(stored)) : defaultState;
	} catch {
		return defaultState;
	}
};

export const [sourcesState, setSourcesState] =
	createStore<SourcesState>(getInitialState());

// Helper to persist to sessionStorage
const persistToStorage = (scrollPositions: SourcesState["scrollPositions"]) => {
	if (!canUseSessionStorage) {
		return;
	}
	const data = JSON.stringify({ ...sourcesState, scrollPositions });
	sessionStorage.setItem(STORAGE_KEY, data);
};

function getScrollKey(mediaSourceId: string, historyEntryKey?: string): string {
	return historyEntryKey
		? `${mediaSourceId}::history:${historyEntryKey}`
		: mediaSourceId;
}

/** Reads the source scroll offset, optionally scoped to a history entry; missing offsets return zero. */
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

/** Updates and immediately persists a source scroll offset, optionally scoped to a history entry. */
export const setScrollPosition = (
	mediaSourceId: string,
	scrollY: number,
	historyEntryKey?: string,
) => {
	const key = getScrollKey(mediaSourceId, historyEntryKey);
	const scrollPositions = { ...sourcesState.scrollPositions, [key]: scrollY };
	setSourcesState((draft) => {
		draft.scrollPositions = scrollPositions;
	});
	persistToStorage(scrollPositions);
};
