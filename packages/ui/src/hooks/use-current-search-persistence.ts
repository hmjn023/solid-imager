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
	searchState,
	setSearchState,
} from "../stores/search-store";

const DEBOUNCE_MS = 1000;

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
	resetSearchState();
	loadPreset(preset);
	setSearchState("selectedSource", selectedSource);
	if (clearActivePreset) {
		setSearchState("activePresetId", null);
	}
}

function restoreCurrentSearchState(
	sourceId: string | null | undefined,
	shouldApply: () => boolean,
) {
	const presetName = getCurrentPresetName(sourceId);
	if (!presetName || typeof sessionStorage === "undefined") {
		return;
	}

	let sessionDataStr: string | null;
	try {
		sessionDataStr = sessionStorage.getItem(presetName);
	} catch {
		if (shouldApply()) {
			resetSearchState();
		}
		return;
	}

	if (!sessionDataStr) {
		if (shouldApply()) {
			resetSearchState();
		}
		return;
	}

	let current: unknown;
	try {
		current = JSON.parse(sessionDataStr);
	} catch {
		if (shouldApply()) {
			resetSearchState();
		}
		return;
	}

	if (!isRecord(current)) {
		if (shouldApply()) {
			resetSearchState();
		}
		return;
	}

	if (current.mode === "vector") {
		if (!shouldApply()) {
			return;
		}
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
			resetSearchState();
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
): Accessor<boolean> {
	const [isRestored, setIsRestored] = createSignal(false);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let restoreVersion = 0;

	const getSourceId = () =>
		typeof sourceId === "function" ? sourceId() : sourceId;
	const resolvePresetName = () => getCurrentPresetName(getSourceId());

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

		untrack(() => restoreCurrentSearchState(currentSourceId, shouldApply));
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

		debounceTimer = setTimeout(() => {
			try {
				sessionStorage.setItem(presetName, JSON.stringify(presetData));
			} catch {
				// Persistence errors must not disrupt the UI.
			}
		}, DEBOUNCE_MS);
	});

	onCleanup(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
	});

	return isRestored;
}
