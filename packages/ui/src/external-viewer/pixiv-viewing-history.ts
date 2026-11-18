import { pixivCardSchema } from "@solid-imager/core/external-viewer";
import type { Accessor } from "solid-js";
import { createViewerRecentHistory } from "./viewer-recent-history";

export function createPixivViewingHistory(scope: Accessor<string | undefined>) {
	const history = createViewerRecentHistory(
		"solid-imager:pixiv-viewing-history:v1:",
		scope,
		pixivCardSchema,
		(post) => post.id,
		100,
	);
	return {
		posts: history.entries,
		record: history.record,
		clear: history.clear,
	};
}
