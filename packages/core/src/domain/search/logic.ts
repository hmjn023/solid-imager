import type { Preset, SearchCriterion, SearchGroup } from "@/domain/media/schemas";
import type { SearchState } from "./schema";

/**
 * Transitions between search modes while attempting to preserve conditions.
 */
export const calculateNextModeState = (
	currentState: SearchState,
	nextMode: "simple" | "pro",
): Partial<SearchState> => {
	if (nextMode === "pro") {
		// Switching from simple to pro: populate advancedCondition from current simple filters
		const condition = getSearchConditionFromState(currentState);
		return {
			mode: "pro" as const,
			advancedCondition: condition || null,
		};
	}
	// Switching from pro back to simple: try to restore filters from advancedCondition
	const simpleStateFromPro = currentState.advancedCondition
		? restoreFromSearchGroup(currentState.advancedCondition)
		: null;

	if (simpleStateFromPro) {
		return {
			mode: "simple" as const,
			...simpleStateFromPro,
		};
	}
	// If cannot be restored perfectly, reset to default simple state
	return {
		mode: "simple" as const,
		searchQuery: "",
		selectedTags: [],
		excludeTags: [],
		selectedProjects: [],
		selectedIps: [],
		selectedCharacters: [],
		selectedAuthors: [],
		advancedCondition: null,
	};
};

/**
 * Tries to map a SearchGroup back to simple search state.
 * Returns null if the condition cannot be represented in simple mode.
 */
export const restoreFromSearchGroup = (group: SearchGroup): Partial<SearchState> | null => {
	// Simple mode is always a top-level AND group
	if (group.operator !== "and") {
		return null;
	}

	const state: Partial<SearchState> = {
		searchQuery: "",
		selectedTags: [],
		excludeTags: [],
		selectedProjects: [],
		selectedIps: [],
		selectedCharacters: [],
		selectedAuthors: [],
		tagMode: "and",
	};

	for (const child of group.children) {
		if (child.type === "group") {
			return null;
		}

		if (!applyCriterionToState(state, child)) {
			return null;
		}
	}

	return state;
};

const applyCriterionToState = (
	state: Partial<SearchState>,
	criterion: SearchCriterion,
): boolean => {
	const { target, operator, value, negate } = criterion;

	if (target === "fileName" && operator === "contains" && !negate) {
		state.searchQuery = value as string;
		return true;
	}

	if (operator !== "equals") {
		return false;
	}

	const targetMap: Record<string, string[] | undefined> = {
		tag: negate ? state.excludeTags : state.selectedTags,
		project: negate ? undefined : state.selectedProjects,
		ip: negate ? undefined : state.selectedIps,
		character: negate ? undefined : state.selectedCharacters,
		author: negate ? undefined : state.selectedAuthors,
	};

	const list = targetMap[target];
	if (list) {
		list.push(value as string);
		return true;
	}

	return false;
};

/**
 * Constructs the SearchGroup based on current mode and filters.
 */
export const getSearchConditionFromState = (state: SearchState): SearchGroup | undefined => {
	if (state.mode === "pro") {
		return state.advancedCondition || undefined;
	}

	// Simple Mode Construction
	const conditions: SearchGroup["children"] = [];

	// Keyword (File name)
	if (state.searchQuery.trim()) {
		conditions.push({
			type: "criterion",
			target: "fileName",
			operator: "contains",
			value: state.searchQuery.trim(),
		});
	}

	// Helpers to add conditions
	addTagConditions(conditions, state);
	addFilterConditions(conditions, "project", state.selectedProjects);
	addFilterConditions(conditions, "ip", state.selectedIps);
	addFilterConditions(conditions, "character", state.selectedCharacters);
	addFilterConditions(conditions, "author", state.selectedAuthors);

	if (conditions.length === 0) {
		return;
	}

	return {
		type: "group",
		operator: "and",
		children: conditions,
	};
};

const addTagConditions = (conditions: SearchGroup["children"], state: SearchState) => {
	// Tags (Positive)
	if (state.selectedTags.length > 0) {
		for (const tag of state.selectedTags) {
			conditions.push({
				type: "criterion",
				target: "tag",
				operator: "equals",
				value: tag,
			});
		}
	}

	// Tags (Negative)
	if (state.excludeTags.length > 0) {
		for (const tag of state.excludeTags) {
			conditions.push({
				type: "criterion",
				target: "tag",
				operator: "equals",
				value: tag,
				negate: true,
			});
		}
	}
};

const addFilterConditions = (
	conditions: SearchGroup["children"],
	target: "project" | "ip" | "character" | "author",
	values: string[],
) => {
	for (const value of values) {
		conditions.push({
			type: "criterion",
			target,
			operator: "equals",
			value,
		});
	}
};

export const preparePresetState = (preset: Preset, currentState: SearchState) => {
	const simpleState = restoreFromSearchGroup(preset.value);
	const sortState = {
		sortBy: (preset.sort as SearchState["sortBy"]) || "date",
		sortOrder: (preset.order as SearchState["sortOrder"]) || "desc",
	};

	if (preset.mode != null) {
		if (preset.mode === "simple" && simpleState) {
			return {
				mode: "simple" as const,
				activePresetId: preset.id,
				advancedCondition: null,
				...simpleState,
				...sortState,
			};
		}
		return {
			mode: "pro" as const,
			activePresetId: preset.id,
			advancedCondition: preset.value,
			searchQuery: "",
			selectedTags: [],
			excludeTags: [],
			selectedProjects: [],
			selectedIps: [],
			selectedCharacters: [],
			selectedAuthors: [],
			...sortState,
		};
	}

	// Fallback for older presets without mode
	if (simpleState) {
		const targetMode = (currentState.mode || "simple") as "simple" | "pro";
		return {
			mode: targetMode,
			activePresetId: preset.id,
			advancedCondition: targetMode === "pro" ? preset.value : null,
			...(targetMode === "simple" ? simpleState : {}),
			...sortState,
		};
	}
	return {
		mode: "pro" as const,
		activePresetId: preset.id,
		advancedCondition: preset.value,
		...sortState,
	};
};
