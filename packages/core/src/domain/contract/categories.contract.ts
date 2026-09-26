import { oc } from "@orpc/contract";
import { z } from "zod";
import { newCategorySchema, updateCategorySchema } from "../categories/schemas";

export const categoriesContract = {
	list: oc.route({
		tags: ["Categories"],
		summary: "カテゴリ一覧取得",
		description: "登録済みのカテゴリを一覧で取得します。",
	}),

	get: oc
		.route({
			tags: ["Categories"],
			summary: "カテゴリ取得",
			description: "UUIDで指定したカテゴリの情報を取得します。",
		})
		.input(z.object({ id: z.string().uuid() })),

	create: oc
		.route({
			tags: ["Categories"],
			summary: "カテゴリ作成",
			description: "新しいカテゴリを登録します。",
		})
		.input(newCategorySchema),

	update: oc
		.route({
			tags: ["Categories"],
			summary: "カテゴリ更新",
			description: "UUIDで指定したカテゴリの情報を更新します。",
		})
		.input(
			z.object({
				id: z.string().uuid(),
				data: updateCategorySchema,
			}),
		),

	delete: oc
		.route({
			tags: ["Categories"],
			summary: "カテゴリ削除",
			description: "UUIDで指定したカテゴリを削除します。",
		})
		.input(z.object({ id: z.string().uuid() }))
		.output(z.object({ success: z.boolean() })),
};
