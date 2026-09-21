export const UI_STORAGE_KEYS = {
	sidebarExpanded: "solid-imager:sidebar-expanded",
	searchViewMode: "solid-imager:search:view-mode",
	sourceViewMode: "solid-imager:source-media:view-mode",
	mediaContext: "solid-imager:media-context",
	mediaReturn: "solid-imager:media-return",
} as const;

const UI_STORAGE_MIGRATIONS: Record<string, string> = {
	[UI_STORAGE_KEYS.sidebarExpanded]: "solid-imager:v2-sidebar-expanded",
	[UI_STORAGE_KEYS.searchViewMode]: "solid-imager:v2:search:view-mode",
	[UI_STORAGE_KEYS.sourceViewMode]: "solid-imager:v2:source-media:view-mode",
	[UI_STORAGE_KEYS.mediaContext]: "v2:media-context",
	[UI_STORAGE_KEYS.mediaReturn]: "v2:media-return",
};

const SEARCH_STATE_STORAGE_PREFIX = "solid-imager:search-state:";
const SEARCH_SCROLL_STORAGE_PREFIX = "solid-imager:search-scroll:";

type StorageReadResult = {
	readonly ok: boolean;
	readonly value: string | null;
};

function readStorageValue(storage: Storage, key: string): StorageReadResult {
	try {
		return { ok: true, value: storage.getItem(key) };
	} catch {
		return { ok: false, value: null };
	}
}

/**
 * Read a canonical UI value, migrating one explicitly named legacy value.
 *
 * A legacy value is kept until a write-and-readback confirms that the
 * canonical value was copied. This lets unavailable or quota-limited storage
 * degrade to an in-memory read without losing the existing value.
 */
function readWithMigration(
	storage: Storage,
	canonicalKey: string,
	legacyKeys: readonly string[],
): string | null {
	const canonical = readStorageValue(storage, canonicalKey);
	if (!canonical.ok || canonical.value !== null) {
		return canonical.value;
	}

	for (const legacyKey of legacyKeys) {
		const legacy = readStorageValue(storage, legacyKey);
		if (!legacy.ok || legacy.value === null) {
			continue;
		}

		let copied = false;
		try {
			storage.setItem(canonicalKey, legacy.value);
			copied = storage.getItem(canonicalKey) === legacy.value;
		} catch {
			// Keep the legacy value when storage is unavailable or over quota.
		}

		if (copied) {
			try {
				storage.removeItem(legacyKey);
			} catch {
				// Removing old data is best effort after a successful copy.
			}
		}
		return legacy.value;
	}

	return null;
}

/**
 * Read a UI preference or media-navigation value, migrating its former key.
 */
export function readUiStorageValue(
	storage: Storage,
	key: string,
): string | null {
	const legacyKey = UI_STORAGE_MIGRATIONS[key];
	return readWithMigration(storage, key, legacyKey ? [legacyKey] : []);
}

/** Remove a canonical UI value and its explicitly mapped predecessor. */
export function removeUiStorageValue(storage: Storage, key: string): void {
	const keys = [key];
	const legacyKey = UI_STORAGE_MIGRATIONS[key];
	if (legacyKey) keys.push(legacyKey);
	for (const storageKey of keys) {
		try {
			storage.removeItem(storageKey);
		} catch {
			// UI storage is optional; a blocked remove must not break navigation.
		}
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

function getLegacySearchStateStorageKeys(
	presetName: string,
): readonly string[] {
	return [`v2:${presetName}`, presetName];
}

function getLegacySearchScrollStorageKeys(
	presetName: string,
	historyEntryKey?: string,
): readonly string[] {
	const suffix = historyEntryKey ? `history:${historyEntryKey}` : presetName;
	return [`search-scroll:v2:${suffix}`, `search-scroll:legacy:${suffix}`];
}

export function readSearchStateStorageValue(
	storage: Storage,
	presetName: string,
): string | null {
	return readWithMigration(
		storage,
		getSearchStateStorageKey(presetName),
		getLegacySearchStateStorageKeys(presetName),
	);
}

export function readSearchScrollStorageValue(
	storage: Storage,
	presetName: string,
	historyEntryKey?: string,
): string | null {
	return readWithMigration(
		storage,
		getSearchScrollStorageKey(presetName, historyEntryKey),
		getLegacySearchScrollStorageKeys(presetName, historyEntryKey),
	);
}
