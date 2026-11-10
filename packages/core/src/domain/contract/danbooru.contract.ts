import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";
import {
	danbooruPostRequestSchema,
	danbooruPostSchema,
	danbooruSearchResultSchema,
	danbooruSearchSchema,
	danbooruTagSchema,
	danbooruTagSearchSchema,
} from "../danbooru/schemas";

export const danbooruContract = {
	search: oc
		.meta(openapi({ tags: ["Danbooru"], summary: "Danbooru の投稿を検索" }))
		.input(danbooruSearchSchema)
		.output(danbooruSearchResultSchema),
	getPost: oc
		.meta(openapi({ tags: ["Danbooru"], summary: "Danbooru の投稿を取得" }))
		.input(danbooruPostRequestSchema)
		.output(danbooruPostSchema),
	suggestTags: oc
		.meta(openapi({ tags: ["Danbooru"], summary: "Danbooru のタグ候補を取得" }))
		.input(danbooruTagSearchSchema)
		.output(z.array(danbooruTagSchema)),
};
