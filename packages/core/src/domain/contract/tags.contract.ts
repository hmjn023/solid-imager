import { openapi } from "@orpc/openapi";
import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	tagDictionaryDetailSchema,
	tagDictionaryLegacyResultSchema,
	tagDictionaryLegacySearchSchema,
	tagDictionaryMigrationSchema,
	tagDictionarySearchResultSchema,
	tagDictionarySearchSchema,
	tagDictionaryStatusSchema,
} from "../tags/dictionary";
import {
	newTagSchema,
	tagResponseSchema,
	updateTagSchema,
} from "../tags/schemas";

export const tagsContract = {
	dictionarySearch: oc
		.meta(openapi({ tags: ["Tags"], summary: "Danbooruタグ辞書の検索" }))
		.input(tagDictionarySearchSchema)
		.output(tagDictionarySearchResultSchema),

	dictionaryDetail: oc
		.meta(openapi({ tags: ["Tags"], summary: "Danbooruタグ辞書の詳細" }))
		.input(z.object({ name: z.string().trim().min(1).max(200) }))
		.output(tagDictionaryDetailSchema.nullable()),

	dictionaryStatus: oc
		.meta(openapi({ tags: ["Tags"], summary: "タグ辞書の取り込み状況" }))
		.output(tagDictionaryStatusSchema),

	dictionaryRefresh: oc
		.meta(openapi({ tags: ["Tags"], summary: "タグ辞書の更新を予約" }))
		.output(tagDictionaryStatusSchema),

	dictionaryLegacy: oc
		.meta(openapi({ tags: ["Tags"], summary: "タグ辞書への移行候補を取得" }))
		.input(tagDictionaryLegacySearchSchema)
		.output(tagDictionaryLegacyResultSchema),

	dictionaryMigrate: oc
		.meta(openapi({ tags: ["Tags"], summary: "旧タグを辞書の正式名に統合" }))
		.input(tagDictionaryMigrationSchema)
		.output(z.object({ success: z.literal(true) })),

	list: oc
		.meta(
			openapi({
				tags: ["Tags"],
				summary: "タグ一覧取得",
				description: "登録済みのタグを一覧で取得します。",
			}),
		)
		.output(z.array(tagResponseSchema)),

	get: oc
		.meta(
			openapi({
				tags: ["Tags"],
				summary: "タグ取得",
				description: "UUIDで指定したタグの情報を取得します。",
			}),
		)
		.input(z.object({ id: z.uuid() }))
		.output(tagResponseSchema),

	create: oc
		.meta(
			openapi({
				tags: ["Tags"],
				summary: "タグ作成",
				description: "新しいタグを登録します。",
			}),
		)
		.input(newTagSchema)
		.output(tagResponseSchema),

	update: oc
		.meta(
			openapi({
				tags: ["Tags"],
				summary: "タグ更新",
				description: "UUIDで指定したタグの情報を更新します。",
			}),
		)
		.input(
			z.object({
				id: z.uuid(),
				data: updateTagSchema,
			}),
		)
		.output(tagResponseSchema),

	delete: oc
		.meta(
			openapi({
				tags: ["Tags"],
				summary: "タグ削除",
				description: "UUIDで指定したタグを削除します。",
			}),
		)
		.input(z.object({ id: z.uuid() }))
		.output(z.object({ success: z.boolean() })),
};
