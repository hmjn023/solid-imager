import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";
import {
	danbooruSearchResultSchema,
	danbooruTagSearchSchema,
	danbooruPostRequestSchema,
	danbooruThumbnailUrlSchema,
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
	pixivImageUrlSchema,
	pixivSearchResultSchema,
} from "../external-viewer/pixiv";
import { omitFromMcp, omitFromOpenApi } from "./publication";
import { binaryResponseBody } from "./binary-response";
import {
	DANBOORU_THUMBNAIL_ROUTE,
	PIXIV_ANIMATION_ROUTE,
	PIXIV_IMAGE_ROUTE,
} from "./http-paths";
import {
	pixivCodeSchema,
	pixivViewerSessionSchema,
	pixivWebSessionSchema,
} from "../external-viewer/pixiv-session";

const pixivAccountProcedure = oc.meta(omitFromOpenApi).meta(omitFromMcp);

const viewerMediaHeadersSchema = z.object({
	"cache-control": z.string().optional(),
	"content-length": z.string().optional(),
	"content-type": z.string().optional(),
	"x-content-type-options": z.string().optional(),
});

export const viewerContract = {
	pixivImage: oc
		.meta(omitFromMcp)
		.meta(
			openapi({
				method: "GET",
				path: PIXIV_IMAGE_ROUTE,
				tags: ["External Viewer"],
				summary: "Pixiv の画像を取得",
				outputStructure: "detailed",
			}),
		)
		.input(z.object({ url: pixivImageUrlSchema }))
		.output(
			z.object({
				headers: viewerMediaHeadersSchema,
				body: binaryResponseBody("image/*"),
			}),
		),
	pixivAnimation: oc
		.meta(omitFromMcp)
		.meta(
			openapi({
				method: "GET",
				path: PIXIV_ANIMATION_ROUTE,
				tags: ["External Viewer"],
				summary: "Pixiv のうごイラを MP4 で取得",
				outputStructure: "detailed",
			}),
		)
		.input(danbooruPostRequestSchema)
		.output(
			z.object({
				headers: viewerMediaHeadersSchema,
				body: binaryResponseBody("video/mp4"),
			}),
		),
	danbooruThumbnail: oc
		.meta(omitFromMcp)
		.meta(
			openapi({
				method: "GET",
				path: DANBOORU_THUMBNAIL_ROUTE,
				tags: ["External Viewer"],
				summary: "Danbooru のサムネイルを取得",
				outputStructure: "detailed",
			}),
		)
		.input(z.object({ url: danbooruThumbnailUrlSchema }))
		.output(
			z.object({
				headers: viewerMediaHeadersSchema,
				body: binaryResponseBody("image/*"),
			}),
		),
	issuePixivCode: pixivAccountProcedure
		.meta(openapi({ method: "POST", path: "/viewer/pixiv/session-codes" }))
		.input(z.object({ sessionId: pixivWebSessionSchema }))
		.output(pixivCodeSchema),
	loginPixiv: pixivAccountProcedure
		.meta(openapi({ method: "POST", path: "/viewer/pixiv/session" }))
		.input(pixivCodeSchema)
		.output(pixivViewerSessionSchema),
	checkPixivSession: pixivAccountProcedure
		.meta(openapi({ method: "GET", path: "/viewer/pixiv/session" }))
		.output(z.object({ userId: z.string() })),
	logoutPixiv: pixivAccountProcedure
		.meta(openapi({ method: "DELETE", path: "/viewer/pixiv/session" }))
		.output(z.null()),
	pixivBookmarks: pixivAccountProcedure
		.meta(openapi({ method: "GET", path: "/viewer/pixiv/bookmarks" }))
		.input(pixivBookmarksRequestSchema)
		.output(pixivSearchResultSchema),
	pixivBookmarkTags: pixivAccountProcedure
		.meta(openapi({ method: "GET", path: "/viewer/pixiv/bookmarks/tags" }))
		.input(z.object({ visibility: pixivBookmarkVisibilitySchema }))
		.output(z.array(z.string())),
	pixivBookmarkState: pixivAccountProcedure
		.meta(openapi({ method: "GET", path: "/viewer/pixiv/posts/{id}/bookmark" }))
		.input(danbooruPostRequestSchema)
		.output(pixivBookmarkStateSchema),
	setPixivBookmark: pixivAccountProcedure
		.meta(openapi({ method: "PUT", path: "/viewer/pixiv/posts/{id}/bookmark" }))
		.input(pixivBookmarkChangeSchema)
		.output(pixivBookmarkStateSchema),
	search: oc
		.meta(
			openapi({
				method: "POST",
				path: "/viewer/search",
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
				method: "GET",
				path: "/viewer/tags/suggestions",
				tags: ["External Viewer"],
				summary: "共通の Danbooru タグ候補",
			}),
		)
		.input(danbooruTagSearchSchema)
		.output(z.array(viewerTagSchema)),
	pixivRelatedPage: oc
		.meta(
			openapi({
				method: "GET",
				path: "/viewer/pixiv/posts/{id}/related-page",
				tags: ["External Viewer"],
				summary: "pixiv の関連作品を追加取得",
			}),
		)
		.input(pixivRelatedRequestSchema)
		.output(pixivRelatedPageSchema),
	pixivRelated: oc
		.meta(
			openapi({
				method: "GET",
				path: "/viewer/pixiv/posts/{id}/related",
				tags: ["External Viewer"],
				summary: "pixiv の関連作品を取得",
			}),
		)
		.input(danbooruPostRequestSchema)
		.output(z.array(pixivCardSchema)),
	pixivArtwork: oc
		.meta(
			openapi({
				method: "GET",
				path: "/viewer/pixiv/posts/{id}",
				tags: ["External Viewer"],
				summary: "pixiv の作品とページを取得",
			}),
		)
		.input(danbooruPostRequestSchema)
		.output(pixivArtworkSchema),
};
