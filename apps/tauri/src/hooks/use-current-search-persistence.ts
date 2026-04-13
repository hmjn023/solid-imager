import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import { PresetClient } from "~/infrastructure/api/clients/preset-client";
import {
	getSearchCondition,
	loadPreset,
	resetSearchState,
	searchState,
	setSearchState,
} from "~/presentation/store/search-store";

const DEBOUNCE_MS = 1000;

const isEqualValue = (left: unknown, right: unknown) =>
	JSON.stringify(left) === JSON.stringify(right);

export function useCurrentSearchPersistence(
	sourceId: string | Accessor<string | null | undefined> = "current",
) {
	const [isInitialLoad, setIsInitialLoad] = createSignal(true);
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

		void (async () => {
			setIsInitialLoad(true);
			try {
				const current = await PresetClient.getByName(presetName);
				if (current) {
					const allPresets = await PresetClient.list();
					const matchingPreset = allPresets.find(
						(preset) =>
							preset.name !== presetName &&
							isEqualValue(preset.value, current.value),
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
					return;
				}

				resetSearchState();
				await PresetClient.create({
					name: presetName,
					value: { type: "group", operator: "and", children: [] },
					mode: "simple",
				});
			} finally {
				setIsInitialLoad(false);
			}
		})();
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
		debounceTimer = setTimeout(() => {
			void saveCurrentState();
		}, DEBOUNCE_MS);
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
			selectedSource: searchState.selectedSource,
			sort: searchState.sortBy,
			order: searchState.sortOrder,
			mode: searchState.mode,
		};

		const current = await PresetClient.getByName(presetName);
		if (current) {
			await PresetClient.update(current.id, presetData);
			return;
		}

		await PresetClient.create({
			name: presetName,
			...presetData,
		});
	};
}
