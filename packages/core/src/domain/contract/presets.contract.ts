import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	createPresetRequestSchema,
	presetSchema,
	updatePresetRequestSchema,
} from "../media/schemas";

export const presetsContract = {
	list: oc
		.route({
			tags: ["Presets"],
			summary: "検索プリセット一覧取得",
			description: "保存済みの検索プリセットを一覧で取得します。",
		})
		.output(z.array(presetSchema)),

	get: oc
		.route({
			tags: ["Presets"],
			summary: "検索プリセット取得",
			description: "数値IDで指定した検索プリセットを取得します。",
		})
		.input(z.object({ id: z.number().int() }))
		.output(presetSchema),

	getByName: oc
		.route({
			tags: ["Presets"],
			summary: "名前で検索プリセット取得",
			description:
				"プリセット名に一致する検索プリセットを取得します。一致する項目がない場合はnullを返します。",
		})
		.input(z.object({ name: z.string() }))
		.output(presetSchema.nullable()),

	create: oc
		.route({
			tags: ["Presets"],
			summary: "検索プリセット作成",
			description: "検索条件を保存する新しいプリセットを作成します。",
		})
		.input(createPresetRequestSchema)
		.output(presetSchema),

	update: oc
		.route({
			tags: ["Presets"],
			summary: "検索プリセット更新",
			description:
				"数値IDで指定した検索プリセットの名前や検索条件を更新します。",
		})
		.input(
			z.object({
				id: z.number().int(),
				data: updatePresetRequestSchema,
			}),
		)
		.output(presetSchema),

	delete: oc
		.route({
			tags: ["Presets"],
			summary: "検索プリセット削除",
			description: "数値IDで指定した検索プリセットを削除します。",
		})
		.input(z.object({ id: z.number().int() }))
		.output(z.object({ success: z.boolean() })),
};
