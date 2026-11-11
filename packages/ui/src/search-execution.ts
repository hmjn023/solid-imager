import {
	getSearchConditionFromState,
	type SearchState,
	type SearchGroup,
} from "@solid-imager/core/search";

/** The query mechanism is independent of the simple/pro condition editor. */
export function getSearchExecutionKind(input: {
	semanticQuery?: string;
	similarityAnchorMediaId?: string | null;
}) {
	if (input.semanticQuery?.trim()) return "semantic";
	if (input.similarityAnchorMediaId) return "similarity";
	return "ordinary";
}

/** Count applied predicates from the current editor's actual expression, never stale simple fields. */
export function getSearchConditionCount(state: SearchState): number {
	const count = (group: SearchGroup): number =>
		group.children.reduce(
			(sum, child) => sum + (child.type === "group" ? count(child) : 1),
			0,
		);
	const condition = getSearchConditionFromState(state);
	return condition ? count(condition) : 0;
}
