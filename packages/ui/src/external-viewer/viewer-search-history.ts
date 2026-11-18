import { viewerRequestSchema } from "@solid-imager/core/external-viewer";
import type { Accessor } from "solid-js";
import { z } from "zod";
import { createViewerRecentHistory } from "./viewer-recent-history";

const searchSchema = z.object({
	tags: viewerRequestSchema.shape.tags.unwrap().min(1),
	literalPixivTag: z.boolean(),
	choices: viewerRequestSchema.shape.choices.unwrap(),
});
export type ViewerSearchHistoryEntry = z.infer<typeof searchSchema>;

export function viewerSearchHistoryKey(entry: ViewerSearchHistoryEntry) {
	return JSON.stringify([
		entry.tags,
		entry.literalPixivTag,
		Object.keys(entry.choices)
			.sort()
			.map((tag) => [tag, entry.choices[tag]]),
	]);
}

export function createPixivSearchHistory(scope: Accessor<string | undefined>) {
	return createViewerRecentHistory(
		"solid-imager:pixiv-search-history:v1:",
		scope,
		searchSchema,
		viewerSearchHistoryKey,
		50,
	);
}
