import { z } from "zod";
import { searchGroupSchema } from "./criteria";
import {
	getSearchConditionFromState,
	prepareSearchConditionState,
} from "./logic";
import { defaultState, searchStateSchema, type SearchState } from "./schema";

// Keep the existing storage keys and accept sessions written before the
// source, mode, and similarity fields were recorded.
const searchSessionSchema = z.object({
	value: searchGroupSchema,
	mode: searchStateSchema.shape.mode.optional(),
	sort: searchStateSchema.shape.sortBy.optional(),
	order: searchStateSchema.shape.sortOrder.optional(),
	selectedSource: z.string().optional().catch(undefined),
	similarityAnchorMediaId: z.string().nullable().catch(null),
	similarityTopK: searchStateSchema.shape.similarityTopK.catch(
		defaultState.similarityTopK,
	),
	similarityModel: searchStateSchema.shape.similarityModel.catch(
		defaultState.similarityModel,
	),
	semanticQuery: z
		.string()
		.transform((query) => query.slice(0, 2000))
		.catch(defaultState.semanticQuery),
});

export function encodeSearchSession(state: SearchState): string {
	const data: z.output<typeof searchSessionSchema> = {
		value: getSearchConditionFromState(state) ?? {
			type: "group",
			operator: "and",
			children: [],
		},
		mode: state.mode,
		sort: state.sortBy,
		order: state.sortOrder,
		selectedSource: state.selectedSource,
		similarityAnchorMediaId: state.similarityAnchorMediaId,
		similarityTopK: state.similarityTopK,
		similarityModel: state.similarityModel,
		semanticQuery: state.semanticQuery,
	};
	return JSON.stringify(data);
}

export function decodeSearchSession(
	text: string,
	fallbackSource: string,
): SearchState | null {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return null;
	}

	const parsed = searchSessionSchema.safeParse(value);
	if (!parsed.success) return null;
	const session = parsed.data;

	return {
		...defaultState,
		...prepareSearchConditionState(session, defaultState.mode),
		selectedSource: session.selectedSource ?? fallbackSource,
		similarityAnchorMediaId: session.similarityAnchorMediaId,
		similarityTopK: session.similarityTopK,
		similarityModel: session.similarityModel,
		semanticQuery: session.semanticQuery,
	};
}
