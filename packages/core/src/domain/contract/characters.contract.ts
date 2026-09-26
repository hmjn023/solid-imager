import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	characterSchema,
	newCharacterSchema,
	updateCharacterSchema,
} from "../characters/schemas";

export const charactersContract = {
	list: oc
		.route({
			tags: ["Characters"],
			summary: "キャラクター一覧取得",
			description: "登録済みのキャラクターを一覧で取得します。",
		})
		.output(z.array(characterSchema)),

	get: oc
		.route({
			tags: ["Characters"],
			summary: "キャラクター取得",
			description: "UUIDで指定したキャラクターの情報を取得します。",
		})
		.input(z.object({ id: z.string().uuid() }))
		.output(characterSchema),

	create: oc
		.route({
			tags: ["Characters"],
			summary: "キャラクター作成",
			description: "新しいキャラクターを登録します。",
		})
		.input(newCharacterSchema)
		.output(characterSchema),

	update: oc
		.route({
			tags: ["Characters"],
			summary: "キャラクター更新",
			description: "UUIDで指定したキャラクターの情報を更新します。",
		})
		.input(
			z.object({
				id: z.string().uuid(),
				data: updateCharacterSchema,
			}),
		)
		.output(characterSchema),

	delete: oc
		.route({
			tags: ["Characters"],
			summary: "キャラクター削除",
			description: "UUIDで指定したキャラクターを削除します。",
		})
		.input(z.object({ id: z.string().uuid() })),

	listForMedia: oc
		.route({
			tags: ["Characters"],
			summary: "メディアのキャラクター一覧取得",
			description:
				"指定したメディアに関連付けられているキャラクターを一覧で取得します。",
		})
		.input(z.object({ mediaId: z.string().uuid() }))
		.output(z.array(characterSchema)),

	addToMedia: oc
		.route({
			tags: ["Characters"],
			summary: "メディアにキャラクターを追加",
			description: "指定したキャラクターをメディアに関連付けます。",
		})
		.input(
			z.object({
				mediaId: z.string().uuid(),
				characterId: z.string().uuid(),
			}),
		)
		.output(z.object({ success: z.boolean() })),

	removeFromMedia: oc
		.route({
			tags: ["Characters"],
			summary: "メディアからキャラクターを削除",
			description: "指定したキャラクターとメディアの関連付けを解除します。",
		})
		.input(
			z.object({
				mediaId: z.string().uuid(),
				characterId: z.string().uuid(),
			}),
		)
		.output(z.object({ success: z.boolean() })),
};
