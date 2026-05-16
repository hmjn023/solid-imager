import type {
	CreatePresetRequest,
	Preset,
	UpdatePresetRequest,
} from "@solid-imager/core/domain/media/schemas";
import { deepEqual } from "@solid-imager/core/utils/deep-equal";
import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import {
	getSearchCondition,
	loadPreset,
	resetSearchState,
	searchState,
	setSearchState,
} from "../stores/search-store";

export interface PresetClientLike {
	list(): Promise<Preset[]>;
	getByName(name: string): Promise<Preset | null | undefined>;
	create(data: CreatePresetRequest): Promise<unknown>;
	update(id: number, data: UpdatePresetRequest): Promise<unknown>;
}

const DEBOUNCE_MS = 1000;

export function useCurrentSearchPersistence(
	sourceId: string | Accessor<string | null | undefined> = "current",
	presetClient: PresetClientLike,
) {
	const [isInitialLoad, setIsInitialLoad] = createSignal(true);
	const [cachedPresetId, setCachedPresetId] = createSignal<number | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	const getCurrentPresetName = () => {
		const id = typeof sourceId === "function" ? sourceId() : sourceId;
		if (id === "current") {
			return "current";
		}
		if (id === "current-all" || id === "all") {
			return "current-all";
		}
		return id ? `current-${id}` : null;
	};

	createEffect(() => {
		const presetName = getCurrentPresetName();
		if (!presetName) {
			return;
		}

		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		const init = async () => {
			setIsInitialLoad(true);

			try {
				const current = await presetClient.getByName(presetName);
				if (current) {
					setCachedPresetId(current.id);
					const allPresets = await presetClient.list();

					const matchingPreset = allPresets.find(
						(p) => p.name !== presetName && deepEqual(p.value, current.value),
					);

					if (matchingPreset) {
						loadPreset({
							...matchingPreset,
							mode: current.mode,
							sort: current.sort,
							order: current.order,
						});
					} else {
						loadPreset(current);
						setSearchState("activePresetId", null);
					}
				} else {
					resetSearchState();
					await presetClient.create({
						name: presetName,
						value: { type: "group", operator: "and", children: [] },
						mode: "simple",
					});
				}
			} catch {
				// silent — persistence errors should not disrupt the UI
			} finally {
				setIsInitialLoad(false);
			}
		};
		init();
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
			searchState.sortBy,
			searchState.sortOrder,
		];
		void _track;

		if (isInitialLoad() || !getCurrentPresetName()) {
			return;
		}

		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		debounceTimer = setTimeout(saveCurrentState, DEBOUNCE_MS);
	});

	onCleanup(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
	});

	const saveCurrentState = async () => {
		const presetName = getCurrentPresetName();
		if (!presetName) {
			return;
		}

		const condition = getSearchCondition() || {
			type: "group" as const,
			operator: "and" as const,
			children: [],
		};

		const presetData = {
			value: condition,
			sort: searchState.sortBy,
			order: searchState.sortOrder,
			mode: searchState.mode,
		};

		try {
			const presetId = cachedPresetId();
			if (presetId !== null) {
				await presetClient.update(presetId, presetData);
			} else {
				const current = await presetClient.getByName(presetName);
				if (current) {
					setCachedPresetId(current.id);
					await presetClient.update(current.id, presetData);
				} else {
					await presetClient.create({
						name: presetName,
						...presetData,
					});
				}
			}
		} catch {
			// silent — persistence errors should not disrupt the UI
		}
	};
}
