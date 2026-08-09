import {
	type Preset,
	presetSchema,
} from "@solid-imager/core/domain/media/schemas";
import {
	type Accessor,
	createEffect,
	createSignal,
	onCleanup,
	untrack,
} from "solid-js";
import { isServer } from "solid-js/web";
import {
	getSearchCondition,
	loadPreset,
	resetSearchState,
	type SearchPersistenceSurface,
	searchState,
	setSearchState,
} from "../stores/search-store";

const DEBOUNCE_MS = 1000;

export type { SearchPersistenceSurface } from "../stores/search-store";

export type SearchPersistenceOptions = {
	surface?: SearchPersistenceSurface;
};

export type SearchPersistenceSource =
	| string
	| Accessor<string | null | undefined>;

function getCurrentPresetName(sourceId: string | null | undefined) {
	if (sourceId === "current") {
		return "current";
	}
	if (sourceId === "current-all" || sourceId === "all") {
		return "current-all";
	}
	return sourceId ? `current-${sourceId}` : null;
}

function getScrollStorageKey(
	presetName: string,
	surface: SearchPersistenceSurface,
): string {
	return `search-scroll:${surface}:${presetName}`;
}

function getStateStorageKey(
	presetName: string,
	surface: SearchPersistenceSurface,
): string {
	return surface === "v2" ? `v2:${presetName}` : presetName;
}

function readScrollPosition(storageKey: string): number {
	try {
		const storedValue = sessionStorage.getItem(storageKey);
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
 * collection scroller.  The reactive persistence effect remains the
 * fallback, while route callbacks can use this helper to avoid sharing the
 * legacy and v2 session keys during rapid scroll updates.
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
	const presetName = getCurrentPresetName(resolvedSourceId);
	if (!presetName) {
		return;
	}

	try {
		sessionStorage.setItem(
			getScrollStorageKey(presetName, options.surface ?? "legacy"),
			String(normalizeScrollPosition(position)),
		);
	} catch {
		// Persistence errors must not disrupt the UI.
	}
}

function resetSearchStatePreservingScroll() {
	const preservedScrollY = searchState.scrollY;
	resetSearchState();
	setSearchState("scrollY", preservedScrollY);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function applyPreset(
	preset: Preset,
	shouldApply: () => boolean,
	clearActivePreset: boolean,
	selectedSource: string,
) {
	if (!shouldApply()) {
		return;
	}
	const preservedScrollY = searchState.scrollY;
	resetSearchState();
	loadPreset(preset);
	setSearchState({ selectedSource, scrollY: preservedScrollY });
	if (clearActivePreset) {
		setSearchState("activePresetId", null);
	}
}

function restoreCurrentSearchState(
	sourceId: string | null | undefined,
	shouldApply: () => boolean,
	surface: SearchPersistenceSurface,
) {
	const presetName = getCurrentPresetName(sourceId);
	if (!presetName || typeof sessionStorage === "undefined") {
		return;
	}

	let sessionDataStr: string | null;
	try {
		sessionDataStr = sessionStorage.getItem(
			getStateStorageKey(presetName, surface),
		);
	} catch {
		if (shouldApply()) {
			resetSearchStatePreservingScroll();
		}
		return;
	}

	if (!sessionDataStr) {
		if (shouldApply()) {
			resetSearchStatePreservingScroll();
		}
		return;
	}

	let current: unknown;
	try {
		current = JSON.parse(sessionDataStr);
	} catch {
		if (shouldApply()) {
			resetSearchStatePreservingScroll();
		}
		return;
	}

	if (!isRecord(current)) {
		if (shouldApply()) {
			resetSearchStatePreservingScroll();
		}
		return;
	}

	if (current.mode === "vector") {
		if (!shouldApply()) {
			return;
		}
		const preservedScrollY = searchState.scrollY;
		const selectedSource =
			typeof current.selectedSource === "string" ? current.selectedSource : "";
		resetSearchState();
		setSearchState({
			mode: "vector",
			selectedSource,
			similarityAnchorMediaId:
				typeof current.similarityAnchorMediaId === "string"
					? current.similarityAnchorMediaId
					: null,
			similarityTopK:
				current.similarityTopK === 20 || current.similarityTopK === 100
					? current.similarityTopK
					: 50,
			scrollY: preservedScrollY,
		});
		return;
	}

	const localPresetResult = presetSchema.safeParse({
		id: -1,
		name: presetName,
		value: current.value,
		sort: current.sort,
		order: current.order,
		mode: current.mode,
		createdAt: new Date(),
	});
	if (!localPresetResult.success) {
		if (shouldApply()) {
			resetSearchStatePreservingScroll();
		}
		return;
	}
	const selectedSource =
		typeof current.selectedSource === "string"
			? current.selectedSource
			: searchState.selectedSource;

	applyPreset(localPresetResult.data, shouldApply, true, selectedSource);
}

export function useCurrentSearchPersistence(
	sourceId: SearchPersistenceSource = "current",
	options: SearchPersistenceOptions = {},
): Accessor<boolean> {
	const [isRestored, setIsRestored] = createSignal(false);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let restoreVersion = 0;
	let lastPersistedPresetName: string | null = null;
	let pendingScrollKey: string | null = null;
	let pendingScrollPosition = 0;

	const getSourceId = () =>
		typeof sourceId === "function" ? sourceId() : sourceId;
	const resolvePresetName = () => getCurrentPresetName(getSourceId());
	const surface = options.surface ?? "legacy";
	const persistPendingScrollPosition = () => {
		if (!pendingScrollKey || isServer) {
			return;
		}
		try {
			sessionStorage.setItem(pendingScrollKey, String(pendingScrollPosition));
		} catch {
			// Persistence errors must not disrupt the UI.
		}
	};

	createEffect(() => {
		const currentSourceId = getSourceId();
		const presetName = getCurrentPresetName(currentSourceId);
		if (!presetName || isServer) {
			return;
		}

		const version = restoreVersion + 1;
		restoreVersion = version;
		let isCurrentRestore = true;
		onCleanup(() => {
			isCurrentRestore = false;
		});
		const shouldApply = () => isCurrentRestore && restoreVersion === version;
		setIsRestored(false);

		untrack(() => {
			setSearchState(
				"scrollY",
				readScrollPosition(getScrollStorageKey(presetName, surface)),
			);
			restoreCurrentSearchState(currentSourceId, shouldApply, surface);
		});
		if (shouldApply()) {
			setIsRestored(true);
		}
	});

	createEffect(() => {
		const _track = [
			searchState.mode,
			searchState.selectedSource,
			searchState.searchQuery,
			searchState.selectedTags,
			searchState.excludeTags,
			searchState.tagMode,
			searchState.selectedProjects,
			searchState.selectedIps,
			searchState.selectedCharacters,
			searchState.selectedAuthors,
			searchState.advancedCondition,
			searchState.similarityAnchorMediaId,
			searchState.similarityTopK,
			searchState.sortBy,
			searchState.sortOrder,
			searchState.scrollY,
		];
		void _track;

		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}

		const presetName = resolvePresetName();
		if (!isRestored() || !presetName || isServer) {
			return;
		}
		const nextScrollKey = getScrollStorageKey(presetName, surface);
		if (pendingScrollKey && pendingScrollKey !== nextScrollKey) {
			persistPendingScrollPosition();
		}
		pendingScrollKey = nextScrollKey;
		pendingScrollPosition = searchState.scrollY;

		const persistCurrentState = () => {
			const condition = getSearchCondition() || {
				type: "group" as const,
				operator: "and" as const,
				children: [],
			};
			const presetData = {
				value: condition,
				selectedSource: searchState.selectedSource,
				sort: searchState.sortBy,
				order: searchState.sortOrder,
				mode: searchState.mode,
				similarityAnchorMediaId: searchState.similarityAnchorMediaId,
				similarityTopK: searchState.similarityTopK,
			};
			try {
				sessionStorage.setItem(
					getStateStorageKey(presetName, surface),
					JSON.stringify(presetData),
				);
				lastPersistedPresetName = presetName;
				persistPendingScrollPosition();
			} catch {
				// Persistence errors must not disrupt the UI.
			}
		};

		// Persist the initial state synchronously so navigating to a media detail
		// before the debounce expires cannot reset the list on return.
		if (lastPersistedPresetName !== presetName) {
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
