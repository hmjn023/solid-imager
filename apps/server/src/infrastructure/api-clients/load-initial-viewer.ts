import { createRouterClient } from "@orpc/server";
import type { ViewerProvider } from "@solid-imager/core/external-viewer";
import {
	initialViewerSearchOptions,
	parseViewerPostId,
	pixivQueryScope,
	viewerPostQueryOptions,
} from "@solid-imager/ui/external-viewer";
import { createServerOnlyFn } from "@tanstack/solid-start";
import { isServer } from "solid-js/web";
import { viewerRouter } from "~/infrastructure/api/routers/viewer-router";
import type { RouteLoaderContext } from "~/infrastructure/router/route-types";
import { getApiOrigin, orpc } from "./orpc-client";

const guestViewer = createServerOnlyFn(() => {
	// Vite's isolated SSR worker uses the harness server for RPC.
	if (process.env.E2E === "1" && process.env.E2E_MODE === "dev")
		return orpc.viewer;
	// A document can contain public works while the tab restores its own account.
	return createRouterClient(viewerRouter, { context: {} });
});

export function loadInitialViewer(provider: ViewerProvider) {
	return async ({
		context: { queryClient },
		location,
	}: RouteLoaderContext & { location: { pathname: string } }) => {
		if (!isServer) return;
		if (parseViewerPostId(location.pathname.split("/")[2])) return;
		const scope = provider === "pixiv" ? pixivQueryScope(getApiOrigin()) : [];
		const viewer = guestViewer();
		const options = initialViewerSearchOptions(
			provider,
			JSON.stringify(scope),
			() =>
				viewer.search({
					provider,
					tags: "",
					page: 1,
					...(provider === "pixiv" ? { pixivFeed: "daily" } : {}),
				}),
		);
		await queryClient.infiniteQuery(options).catch(() => {
			queryClient.removeQueries({ queryKey: options.queryKey, exact: true });
		});
	};
}

export function loadInitialViewerPost(provider: ViewerProvider) {
	return async ({
		context: { queryClient },
		params,
	}: RouteLoaderContext<{ postId: string }>) => {
		if (!isServer) return;
		const id = parseViewerPostId(params.postId);
		if (id === undefined) return;
		const load =
			provider === "pixiv"
				? queryClient.query(
						viewerPostQueryOptions(
							provider,
							id,
							(postId) => guestViewer().pixivArtwork({ id: postId }),
							pixivQueryScope(getApiOrigin()),
						),
					)
				: queryClient.query(
						viewerPostQueryOptions(provider, id, (postId) =>
							orpc.danbooru.getPost({ id: postId }),
						),
					);
		await load.catch(() => queryClient.removeQueries({ queryKey: [provider] }));
	};
}
