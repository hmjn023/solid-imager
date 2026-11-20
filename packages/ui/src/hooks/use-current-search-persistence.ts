import {
	decodeSearchSession,
	defaultState,
	encodeSearchSession,
} from "@solid-imager/core/search";
import {
	type Accessor,
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	untrack,
} from "solid-js";
import { isServer } from "solid-js/web";
import { searchState, setSearchState } from "../stores/search-store";
import {
	getSearchScrollStorageKey,
	getSearchStateStorageKey,
	getSessionStorage,
	readSearchScrollStorageValue,
	readSearchStateStorageValue,
} from "../ui-storage";

const DEBOUNCE_MS = 1000;

export type SearchPersistenceOptions = {
	historyEntryKey?: string | Accessor<string | undefined>;
};

export type SearchPersistenceSource =
	| string
	| Accessor<string | null | undefined>;

function getCurrentSessionName(sourceId: string | null | undefined) {
	if (sourceId === "current") {
		return "current";
	}
	if (sourceId === "current-all" || sourceId === "all") {
		return "current-all";
	}
	return sourceId ? `current-${sourceId}` : null;
}

function readScrollPosition(
	sessionName: string,
	historyEntryKey?: string,
): number {
	const storage = getSessionStorage();
	if (!storage) return 0;
	try {
		const storedValue = readSearchScrollStorageValue(
			storage,
			sessionName,
			historyEntryKey,
		);
		if (storedValue === null) {
			return 0;
		}
		const scrollPosition = Number(storedValue);
		return Number.isFinite(scrollPosition) && scrollPosition >= 0
			? scrollPosition
			: 0;
	} catch {
		return 0;
	}
}

function normalizeScrollPosition(value: number): number {
	return Number.isFinite(value) && value >= 0 ? value : 0;
}

/**
 * Persist the scroll owner explicitly when a route owns a non-window
 * collection scroller. The reactive persistence effect remains the fallback,
 * while route callbacks can use this helper during rapid scroll updates.
 */
export function persistSearchScrollPosition(
	sourceId: SearchPersistenceSource = "current",
	position: number,
	options: SearchPersistenceOptions = {},
): void {
	if (isServer) {
		return;
	}

	const resolvedSourceId =
		typeof sourceId === "function" ? sourceId() : sourceId;
	const sessionName = getCurrentSessionName(resolvedSourceId);
	if (!sessionName) {
		return;
	}

	try {
		const storage = getSessionStorage();
		if (!storage) return;
		const historyEntryKey =
			typeof options.historyEntryKey === "function"
				? options.historyEntryKey()
				: options.historyEntryKey;
		storage.setItem(
			getSearchScrollStorageKey(sessionName, historyEntryKey),
			String(normalizeScrollPosition(position)),
		);
	} catch {
		// Persistence errors must not disrupt the UI.
	}
}

/**
 * Reads a session scroll offset; invalid or unavailable values return zero.
 *
 * @param sourceId - Source key or reactive accessor; defaults to the current search.
 * @param options - Optional history entry key for independently restored positions.
 * @returns The stored non-negative offset in pixels, or zero.
 */
export function readPersistedSearchScrollPosition(
	sourceId: SearchPersistenceSource = "current",
	options: SearchPersistenceOptions = {},
): number {
	if (isServer) return 0;
	const resolvedSourceId =
		typeof sourceId === "function" ? sourceId() : sourceId;
	const sessionName = getCurrentSessionName(resolvedSourceId);
	if (!sessionName) return 0;
	const historyEntryKey =
		typeof options.historyEntryKey === "function"
			? options.historyEntryKey()
			: options.historyEntryKey;
	try {
		return readScrollPosition(sessionName, historyEntryKey);
	} catch {
		return 0;
	}
}

/**
 * Restores and persists source-specific search state in session storage.
 * Subsequent state changes are debounced; pending scroll position is flushed on cleanup.
 *
 * @param sourceId - Source key or reactive accessor; a missing value suspends persistence.
 * @param options - Optional history entry key used to isolate scroll positions.
 * @returns An accessor indicating that restoration for the current source completed.
 */
export function useCurrentSearchPersistence(
	sourceId: SearchPersistenceSource = "current",
	options: SearchPersistenceOptions = {},
): Accessor<boolean> {
	const [isRestored, setIsRestored] = createSignal(false);
	const trackSession = createMemo(() =>
		isServer ? "" : encodeSearchSession(searchState),
	);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let lastPersistedSessionName: string | null = null;
	let pendingScrollKey: string | null = null;
	let pendingScrollPosition = 0;

	const getSourceId = () =>
		typeof sourceId === "function" ? sourceId() : sourceId;
	const resolveSessionName = () => getCurrentSessionName(getSourceId());
	const resolveHistoryEntryKey = () =>
		typeof options.historyEntryKey === "function"
			? options.historyEntryKey()
			: options.historyEntryKey;
	const persistPendingScrollPosition = () => {
		if (!pendingScrollKey || isServer) {
			return;
		}
		try {
			const storage = getSessionStorage();
			if (!storage) return;
			storage.setItem(pendingScrollKey, String(pendingScrollPosition));
		} catch {
			// Persistence errors must not disrupt the UI.
		}
	};

	createEffect(() => {
		const currentSourceId = getSourceId();
		const sessionName = getCurrentSessionName(currentSourceId);
		if (!sessionName || isServer) {
			return;
		}

		setIsRestored(false);
		untrack(() => {
			const scrollY = readScrollPosition(sessionName, resolveHistoryEntryKey());
			const storage = getSessionStorage();
			const saved =
				storage && readSearchStateStorageValue(storage, sessionName);
			if (storage) {
				const state = saved
					? decodeSearchSession(saved, searchState.selectedSource)
					: null;
				setSearchState({ ...(state ?? defaultState), scrollY });
			} else {
				setSearchState("scrollY", scrollY);
			}
		});
		setIsRestored(true);
	});

	createEffect(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}

		const sessionName = resolveSessionName();
		if (!isRestored() || !sessionName || isServer) {
			return;
		}
		const nextScrollKey = getSearchScrollStorageKey(
			sessionName,
			resolveHistoryEntryKey(),
		);
		if (pendingScrollKey && pendingScrollKey !== nextScrollKey) {
			persistPendingScrollPosition();
		}
		pendingScrollKey = nextScrollKey;
		pendingScrollPosition = searchState.scrollY;
		const trackedSession = trackSession();
		const initialSave = lastPersistedSessionName !== sessionName;
		// Restoration can update the store in the same effect cycle as the first
		// save. Read it directly before the memo has refreshed in that cycle.
		const serializedSession = initialSave
			? untrack(() => encodeSearchSession(searchState))
			: trackedSession;

		const persistCurrentState = () => {
			try {
				const storage = getSessionStorage();
				if (!storage) return;
				storage.setItem(
					getSearchStateStorageKey(sessionName),
					serializedSession,
				);
				lastPersistedSessionName = sessionName;
				persistPendingScrollPosition();
			} catch {
				// Persistence errors must not disrupt the UI.
			}
		};

		// Persist the initial state synchronously so navigating to a media detail
		// before the debounce expires cannot reset the list on return.
		if (initialSave) {
			persistCurrentState();
			return;
		}

		debounceTimer = setTimeout(persistCurrentState, DEBOUNCE_MS);
	});

	onCleanup(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		persistPendingScrollPosition();
	});

	return isRestored;
}
