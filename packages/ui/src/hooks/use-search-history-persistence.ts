import type {
	SafeSearchSnapshot,
	SearchSnapshotState,
} from "@solid-imager/core/domain/search/history";
import { searchSnapshotStateSchema } from "@solid-imager/core/domain/search/history";
import type { HistoryLocation } from "@tanstack/solid-router";
import { useLocation, useRouter } from "@tanstack/solid-router";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import type { SearchHistoryClient } from "../search-history-client";
import {
	resetSearchState,
	searchState,
	setSearchState,
} from "../stores/search-store";
import {
	readPersistedSearchScrollPosition,
	type SearchPersistenceOptions,
	type SearchPersistenceSource,
	useCurrentSearchPersistence,
} from "./use-current-search-persistence";

const HISTORY_VERSION = 1 as const;
const HISTORY_COMMIT_DEBOUNCE_MS = 500;

type HistorySnapshotEntry = {
	version: typeof HISTORY_VERSION;
	id?: string;
	state: SearchSnapshotState;
};

type NavigationBlockerArgs = {
	currentLocation: Pick<HistoryLocation, "pathname">;
	nextLocation: Pick<HistoryLocation, "pathname" | "href" | "state">;
	action: "PUSH" | "REPLACE" | "FORWARD" | "BACK" | "GO";
};

type SearchHistoryOptions = SearchPersistenceOptions & {
	client: SearchHistoryClient;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function getRecord(value: unknown): Record<string, unknown> {
	return isRecord(value) ? value : {};
}

function parseHistoryEntry(value: unknown): HistorySnapshotEntry | null {
	const record = getRecord(value);
	const candidate = record.searchSnapshot;
	if (!isRecord(candidate) || candidate.version !== HISTORY_VERSION) {
		return null;
	}
	const parsed = searchSnapshotStateSchema.safeParse(candidate.state);
	if (!parsed.success) {
		return null;
	}
	return {
		version: HISTORY_VERSION,
		...(typeof candidate.id === "string" ? { id: candidate.id } : {}),
		state: parsed.data,
	};
}

function readSnapshotState(): SearchSnapshotState {
	return searchSnapshotStateSchema.parse({
		mode: searchState.mode,
		searchQuery: searchState.searchQuery,
		selectedTags: [...searchState.selectedTags],
		excludeTags: [...searchState.excludeTags],
		tagMode: searchState.tagMode,
		selectedSource: searchState.selectedSource,
		selectedProjects: [...searchState.selectedProjects],
		selectedIps: [...searchState.selectedIps],
		selectedCharacters: [...searchState.selectedCharacters],
		selectedAuthors: [...searchState.selectedAuthors],
		advancedCondition: searchState.advancedCondition,
		similarityAnchorMediaId: searchState.similarityAnchorMediaId,
		similarityTopK: searchState.similarityTopK,
		limit: searchState.limit,
		sortBy: searchState.sortBy,
		sortOrder: searchState.sortOrder,
	});
}

function stateKey(state: SearchSnapshotState): string {
	return JSON.stringify(state);
}

function applySnapshotState(state: SearchSnapshotState, scrollY = 0): void {
	resetSearchState();
	setSearchState({ ...state, offset: 0, scrollY });
}

function createPathWithoutSnapshot(href: string): string {
	const url = new URL(href, "http://solid-imager.invalid");
	url.searchParams.delete("search");
	return `${url.pathname}${url.search}${url.hash}`;
}

function createPathWithSnapshot(href: string, id: string): string {
	const url = new URL(href, "http://solid-imager.invalid");
	url.searchParams.set("search", id);
	return `${url.pathname}${url.search}${url.hash}`;
}

function readSnapshotId(href: string): string | undefined {
	const id = new URL(href, "http://solid-imager.invalid").searchParams.get(
		"search",
	);
	return id || undefined;
}

function readHistoryEntryKey(state: unknown, href: string): string {
	const record = getRecord(state);
	const key = record.__TSR_key ?? record.key;
	return typeof key === "string" && key.length > 0 ? key : href;
}

function mergeHistoryEntry(
	state: unknown,
	entry: HistorySnapshotEntry,
): Record<string, unknown> {
	return {
		...getRecord(state),
		searchSnapshot: entry,
	};
}

function removeSearchSnapshot(state: unknown): Record<string, unknown> {
	const nextState = { ...getRecord(state) };
	delete nextState.searchSnapshot;
	return nextState;
}

/**
 * Restores a search state from the URL/history entry and captures settled
 * result-changing state as browser history entries.
 */
export function useSearchHistoryPersistence(
	sourceId: SearchPersistenceSource,
	options: SearchHistoryOptions,
) {
	const sessionRestored = useCurrentSearchPersistence(sourceId, options);
	const router = useRouter();
	const location = useLocation();
	const [historyRestored, setHistoryRestored] = createSignal(false);
	let lastEntryKey: string | null = null;
	let lastSessionReady: boolean | null = null;
	let skipNextCommitState: string | null = null;
	let restoreGeneration = 0;
	let commitTimer: ReturnType<typeof setTimeout> | null = null;

	const isRestored = createMemo(() => sessionRestored() && historyRestored());

	const currentHref = () => router.history.location.href;
	const currentHistoryState = () => router.history.location.state;
	const routePathname = new URL(currentHref(), "http://solid-imager.invalid")
		.pathname;
	const currentEntryKey = () =>
		readHistoryEntryKey(currentHistoryState(), currentHref());

	const replaceWithLocalEntry = (entry: HistorySnapshotEntry): string => {
		router.history.replace(
			createPathWithoutSnapshot(currentHref()),
			mergeHistoryEntry(currentHistoryState(), entry),
			{ ignoreBlocker: true },
		);
		router.history.flush();
		return currentEntryKey();
	};

	const captureForCurrentEntry = async (
		entryKey: string,
		state: SearchSnapshotState,
	) => {
		try {
			const response = await options.client.capture(state);
			if (
				new URL(currentHref(), "http://solid-imager.invalid").pathname !==
					routePathname ||
				currentEntryKey() !== entryKey
			) {
				return;
			}
			const currentEntry = parseHistoryEntry(currentHistoryState());
			const nextEntry: HistorySnapshotEntry = {
				version: HISTORY_VERSION,
				id: response.id,
				state: currentEntry?.state ?? state,
			};
			const path = createPathWithSnapshot(currentHref(), response.id);
			router.history.replace(
				path,
				mergeHistoryEntry(currentHistoryState(), nextEntry),
				{ ignoreBlocker: true },
			);
			router.history.flush();
		} catch {
			// The local history entry remains usable when the server is unavailable.
		}
	};

	createEffect(() => {
		if (isServer) return;
		location();
		const sessionReady = sessionRestored();
		const href = currentHref();
		const entryKey = currentEntryKey();
		if (entryKey === lastEntryKey && sessionReady === lastSessionReady) return;
		lastEntryKey = entryKey;
		lastSessionReady = sessionReady;
		const generation = ++restoreGeneration;
		setHistoryRestored(false);
		const queryId = readSnapshotId(href);
		const localEntry = parseHistoryEntry(currentHistoryState());

		const restore = async () => {
			let snapshotState: SearchSnapshotState | null = null;
			if (queryId && localEntry?.id === queryId) {
				snapshotState = localEntry.state;
			} else if (queryId) {
				try {
					const snapshot: SafeSearchSnapshot =
						await options.client.get(queryId);
					if (generation !== restoreGeneration) return;
					snapshotState = snapshot.state;
				} catch {
					if (generation !== restoreGeneration) return;
					// A deleted/invalid shared snapshot falls back to the current session.
					router.history.replace(
						createPathWithoutSnapshot(href),
						getRecord(currentHistoryState()),
						{ ignoreBlocker: true },
					);
					router.history.flush();
				}
			} else if (localEntry) {
				snapshotState = localEntry.state;
			}

			if (generation !== restoreGeneration) return;
			if (snapshotState) {
				applySnapshotState(
					snapshotState,
					readPersistedSearchScrollPosition(sourceId, {
						surface: options.surface,
						historyEntryKey: entryKey,
					}),
				);
				skipNextCommitState = stateKey(snapshotState);
				setHistoryRestored(true);
				return;
			}
			if (!sessionReady) {
				setHistoryRestored(false);
				return;
			}

			const state = readSnapshotState();
			skipNextCommitState = stateKey(state);
			const entry: HistorySnapshotEntry = {
				version: HISTORY_VERSION,
				state,
			};
			const localEntryKey = replaceWithLocalEntry(entry);
			setHistoryRestored(true);
			void captureForCurrentEntry(localEntryKey, state);
		};

		void restore();
	});

	const commitCurrentState = () => {
		if (
			!isRestored() ||
			new URL(currentHref(), "http://solid-imager.invalid").pathname !==
				routePathname
		) {
			return;
		}
		const state = readSnapshotState();
		const key = stateKey(state);
		if (skipNextCommitState === key) {
			skipNextCommitState = null;
			return;
		}
		const currentEntry = parseHistoryEntry(currentHistoryState());
		if (currentEntry && stateKey(currentEntry.state) === key) return;
		skipNextCommitState = key;
		const entry: HistorySnapshotEntry = { version: HISTORY_VERSION, state };
		router.history.push(
			createPathWithoutSnapshot(currentHref()),
			mergeHistoryEntry(currentHistoryState(), entry),
			{ ignoreBlocker: true },
		);
		router.history.flush();
		const pushedKey = currentEntryKey();
		void captureForCurrentEntry(pushedKey, state);
	};

	let navigationCommitTriggered = false;
	const disposeNavigationBlocker = isServer
		? undefined
		: router.history.block({
				enableBeforeUnload: false,
				blockerFn: ({
					currentLocation,
					nextLocation,
					action,
				}: NavigationBlockerArgs) => {
					if (
						(action !== "PUSH" && action !== "REPLACE") ||
						currentLocation.pathname !== routePathname ||
						nextLocation.pathname === routePathname
					) {
						return false;
					}
					navigationCommitTriggered = true;
					commitCurrentState();
					if (action === "REPLACE") {
						router.history.replace(
							nextLocation.href,
							removeSearchSnapshot(nextLocation.state),
							{
								ignoreBlocker: true,
							},
						);
					} else {
						router.history.push(
							nextLocation.href,
							removeSearchSnapshot(nextLocation.state),
							{ ignoreBlocker: true },
						);
					}
					router.history.flush();
					return true;
				},
			});

	createEffect(() => {
		if (isServer || !isRestored()) return;
		const state = readSnapshotState();
		const key = stateKey(state);
		if (skipNextCommitState === key) {
			skipNextCommitState = null;
			return;
		}
		if (commitTimer) clearTimeout(commitTimer);
		commitTimer = setTimeout(() => {
			commitTimer = null;
			commitCurrentState();
		}, HISTORY_COMMIT_DEBOUNCE_MS);
	});

	onCleanup(() => {
		disposeNavigationBlocker?.();
		if (!navigationCommitTriggered) commitCurrentState();
		if (commitTimer) clearTimeout(commitTimer);
	});

	return {
		isRestored,
		commitNow: commitCurrentState,
		historyEntryKey: currentEntryKey,
	};
}
