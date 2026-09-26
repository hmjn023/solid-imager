export const UI_STORAGE_KEYS = {
	sidebarExpanded: "solid-imager:sidebar-expanded",
	searchViewMode: "solid-imager:search:view-mode",
	sourceViewMode: "solid-imager:source-media:view-mode",
	mediaContext: "solid-imager:media-context",
	mediaReturn: "solid-imager:media-return",
} as const;

const SEARCH_STATE_STORAGE_PREFIX = "solid-imager:search-state:";
const SEARCH_SCROLL_STORAGE_PREFIX = "solid-imager:search-scroll:";

/** Read a UI preference or media-navigation value. */
export function readUiStorageValue(
	storage: Storage,
	key: string,
): string | null {
	try {
		return storage.getItem(key);
	} catch {
		return null;
	}
}

/** Remove a UI storage value. */
export function removeUiStorageValue(storage: Storage, key: string): void {
	try {
		storage.removeItem(key);
	} catch {
		// UI storage is optional; a blocked remove must not break navigation.
	}
}

export function getSearchStateStorageKey(presetName: string): string {
	return `${SEARCH_STATE_STORAGE_PREFIX}${presetName}`;
}

export function getSearchScrollStorageKey(
	presetName: string,
	historyEntryKey?: string,
): string {
	return historyEntryKey
		? `${SEARCH_SCROLL_STORAGE_PREFIX}history:${historyEntryKey}`
		: `${SEARCH_SCROLL_STORAGE_PREFIX}${presetName}`;
}

export function readSearchStateStorageValue(
	storage: Storage,
	presetName: string,
): string | null {
	return readUiStorageValue(storage, getSearchStateStorageKey(presetName));
}

export function readSearchScrollStorageValue(
	storage: Storage,
	presetName: string,
	historyEntryKey?: string,
): string | null {
	return readUiStorageValue(
		storage,
		getSearchScrollStorageKey(presetName, historyEntryKey),
	);
}
