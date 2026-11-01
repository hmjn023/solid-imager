import { openapi } from "@orpc/openapi";
import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	newTagSchema,
	tagResponseSchema,
	updateTagSchema,
} from "../tags/schemas";

export const tagsContract = {
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
