import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";
import {
	danbooruSearchResultSchema,
	danbooruTagSearchSchema,
	danbooruPostRequestSchema,
} from "../danbooru/schemas";
import {
	pixivBookmarksRequestSchema,
	pixivBookmarkVisibilitySchema,
	viewerRequestSchema,
	viewerTagSchema,
} from "../external-viewer/search";
import {
	pixivCardSchema,
	pixivBookmarkChangeSchema,
	pixivBookmarkStateSchema,
	pixivRelatedRequestSchema,
	pixivRelatedPageSchema,
	pixivArtworkSchema,
	pixivSearchResultSchema,
} from "../external-viewer/pixiv";
import { rpcOnly } from "./rest-visibility";
import {
	pixivCodeSchema,
	pixivViewerSessionSchema,
	pixivWebSessionSchema,
} from "../external-viewer/pixiv-session";

export const viewerContract = {
	issuePixivCode: oc
		.meta(rpcOnly)
		.input(z.object({ sessionId: pixivWebSessionSchema }))
		.output(pixivCodeSchema),
	loginPixiv: oc
		.meta(rpcOnly)
		.input(pixivCodeSchema)
		.output(pixivViewerSessionSchema),
	checkPixivSession: oc.meta(rpcOnly).output(z.object({ userId: z.string() })),
	logoutPixiv: oc.meta(rpcOnly).output(z.null()),
	pixivBookmarks: oc
		.meta(rpcOnly)
		.input(pixivBookmarksRequestSchema)
		.output(pixivSearchResultSchema),
	pixivBookmarkTags: oc
		.meta(rpcOnly)
		.input(z.object({ visibility: pixivBookmarkVisibilitySchema }))
		.output(z.array(z.string())),
	pixivBookmarkState: oc
		.meta(rpcOnly)
		.input(danbooruPostRequestSchema)
		.output(pixivBookmarkStateSchema),
	setPixivBookmark: oc
		.meta(rpcOnly)
		.input(pixivBookmarkChangeSchema)
		.output(pixivBookmarkStateSchema),
	search: oc
		.meta(
			openapi({
				tags: ["External Viewer"],
				summary: "共通タグ式で外部サイトを検索",
			}),
		)
		.input(viewerRequestSchema)
		.output(
			z.discriminatedUnion("provider", [
				danbooruSearchResultSchema.extend({ provider: z.literal("danbooru") }),
				pixivSearchResultSchema,
			]),
		),
	suggestTags: oc
		.meta(
			openapi({
				tags: ["External Viewer"],
				summary: "共通の Danbooru タグ候補",
			}),
		)
		.input(danbooruTagSearchSchema)
		.output(z.array(viewerTagSchema)),
	pixivRelatedPage: oc
		.meta(
			openapi({
				tags: ["External Viewer"],
				summary: "pixiv の関連作品を追加取得",
			}),
		)
		.input(pixivRelatedRequestSchema)
		.output(pixivRelatedPageSchema),
	pixivRelated: oc
		.meta(
			openapi({ tags: ["External Viewer"], summary: "pixiv の関連作品を取得" }),
		)
		.input(danbooruPostRequestSchema)
		.output(z.array(pixivCardSchema)),
	pixivArtwork: oc
		.meta(
			openapi({
				tags: ["External Viewer"],
				summary: "pixiv の作品とページを取得",
			}),
		)
		.input(danbooruPostRequestSchema)
		.output(pixivArtworkSchema),
};
