import { z } from "zod";
import { searchStateSchema } from "./schema";

/**
 * The part of the search state that determines a result query.
 *
 * Pagination, scroll position, and the selected user preset are local UI
 * concerns. Keeping them out of the snapshot makes the same search reusable
 * across different list surfaces and prevents scrolling from creating a new
 * search history item.
 */
export const searchSnapshotStateSchema = searchStateSchema.omit({
	activePresetId: true,
	offset: true,
	scrollY: true,
});

export type SearchSnapshotState = z.infer<typeof searchSnapshotStateSchema>;

export const searchSnapshotVersionSchema = z.literal(1);

export const searchSnapshotSchema = z.object({
	id: z.uuid({ version: "v4" }),
	version: searchSnapshotVersionSchema,
	fingerprint: z.string().min(1),
	state: searchSnapshotStateSchema,
	createdAt: z.coerce.date(),
});

export type SearchSnapshot = z.infer<typeof searchSnapshotSchema>;

/**
 * Explicitly public search state returned by the history API.
 *
 * Keep this list separate from the persistence schema so adding an internal
 * snapshot field cannot implicitly expose it to clients.
 */
export const safeSearchSnapshotStateSchema = searchSnapshotStateSchema.pick({
	mode: true,
	searchQuery: true,
	selectedTags: true,
	excludeTags: true,
	tagMode: true,
	selectedSource: true,
	selectedProjects: true,
	selectedIps: true,
	selectedCharacters: true,
	selectedAuthors: true,
	advancedCondition: true,
	similarityAnchorMediaId: true,
	similarityTopK: true,
	limit: true,
	sortBy: true,
	sortOrder: true,
});

export type SafeSearchSnapshotState = z.infer<
	typeof safeSearchSnapshotStateSchema
>;

export const safeSearchSnapshotSchema = z.object({
	id: z.uuid({ version: "v4" }),
	version: searchSnapshotVersionSchema,
	state: safeSearchSnapshotStateSchema,
});

export type SafeSearchSnapshot = z.infer<typeof safeSearchSnapshotSchema>;

export const captureSearchSnapshotRequestSchema = z.object({
	state: searchSnapshotStateSchema,
});

export type CaptureSearchSnapshotRequest = z.infer<
	typeof captureSearchSnapshotRequestSchema
>;

export const captureSearchSnapshotResponseSchema = z.object({
	id: z.uuid({ version: "v4" }),
});

export type CaptureSearchSnapshotResponse = z.infer<
	typeof captureSearchSnapshotResponseSchema
>;

export const getSearchSnapshotRequestSchema = z.object({
	id: z.uuid({ version: "v4" }),
});

export type GetSearchSnapshotRequest = z.infer<
	typeof getSearchSnapshotRequestSchema
>;
