import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";
import {
	danbooruSearchResultSchema,
	danbooruTagSearchSchema,
	danbooruPostRequestSchema,
} from "../danbooru/schemas";
import {
	viewerRequestSchema,
	viewerTagSchema,
} from "../external-viewer/search";
import {
	pixivArtworkSchema,
	pixivSearchResultSchema,
} from "../external-viewer/pixiv";
export const viewerContract = {
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
