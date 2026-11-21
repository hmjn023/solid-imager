import type { Preset } from "../presets/schemas";
import type { SearchCriterion, SearchGroup } from "./criteria";
import type { SearchState } from "./schema";

/** Ignore unfinished numeric inputs; explicit empty checks still search for NULL. */
function omitEmptyNumericCriteria(group: SearchGroup): SearchGroup | undefined {
	const children: SearchGroup["children"] = [];
	for (const child of group.children) {
		if (child.type === "group") {
			const nested = omitEmptyNumericCriteria(child);
			if (nested) children.push(nested);
		} else {
			const numeric = [
				"rating",
				"viewCount",
				"fileSize",
				"width",
				"height",
			].includes(child.target);
			const needsValue =
				child.operator !== "isEmpty" && child.operator !== "isNotEmpty";
			if (numeric && needsValue && (child.value === null || child.value === ""))
				continue;
			children.push(child);
		}
	}
	return children.length ? { ...group, children } : undefined;
}

/**
 * Transitions between search modes while attempting to preserve conditions.
 * If a pro condition cannot be represented in simple mode, simple filters are reset.
 *
 * @param currentState - State from which to derive the target mode.
 * @param nextMode - Mode to switch to.
 * @returns A partial state update; unrelated state fields are left to the caller.
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
 * Nested groups, non-AND groups and unsupported criteria cannot be represented.
 *
 * @param group - Advanced search expression to convert.
 * @returns The corresponding simple filter fields, or null if conversion fails.
 */
export const restoreFromSearchGroup = (
	group: SearchGroup,
): Partial<SearchState> | null => {
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

	if (target === "keyword" && operator === "contains" && !negate) {
		if (typeof value === "string") {
			state.searchQuery = value;
			return true;
		}
		return false;
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
	if (list && typeof value === "string") {
		list.push(value);
		return true;
	}

	return false;
};

/**
 * Constructs the SearchGroup based on current mode and filters.
 *
 * @param state - Current search mode and filter values.
 * @returns The advanced condition in pro mode, a group in simple mode, or
 * undefined if there is no condition.
 */
export const getSearchConditionFromState = (
	state: SearchState,
): SearchGroup | undefined => {
	if (state.mode === "pro") {
		return state.advancedCondition
			? omitEmptyNumericCriteria(state.advancedCondition)
			: undefined;
	}

	// Simple Mode Construction
	const conditions: SearchGroup["children"] = [];

	// Keyword (File name, description, prompt, etc.)
	if (state.searchQuery.trim()) {
		conditions.push({
			type: "criterion",
			target: "keyword",
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

const addTagConditions = (
	conditions: SearchGroup["children"],
	state: SearchState,
) => {
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

/** Builds the state changes needed to apply a saved user preset. */
export const preparePresetState = (
	preset: Preset,
	currentState: SearchState,
) => ({
	...prepareSearchConditionState(preset, currentState.mode),
	activePresetId: preset.id,
});

/** Applies the saved condition, using the supplied mode for legacy values. */
export const prepareSearchConditionState = (
	saved: Pick<Preset, "value" | "mode" | "sort" | "order">,
	fallbackMode: SearchState["mode"],
): Partial<SearchState> => {
	const simpleState = restoreFromSearchGroup(saved.value);
	const sortState = {
		sortBy: saved.sort || "date",
		sortOrder: saved.order || "desc",
	};

	if (saved.mode != null) {
		if (saved.mode === "simple" && simpleState) {
			return {
				mode: "simple" as const,
				advancedCondition: null,
				...simpleState,
				...sortState,
			};
		}
		return {
			mode: "pro" as const,
			advancedCondition: saved.value,
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
		const targetMode = fallbackMode;
		return {
			mode: targetMode,
			advancedCondition: targetMode === "pro" ? saved.value : null,
			...(targetMode === "simple" ? simpleState : {}),
			...sortState,
		};
	}
	return {
		mode: "pro" as const,
		advancedCondition: saved.value,
		...sortState,
	};
};
