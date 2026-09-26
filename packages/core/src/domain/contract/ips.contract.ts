import { oc } from "@orpc/contract";
import { z } from "zod";
import { ipSchema } from "../ips/schemas";

export const ipsContract = {
	list: oc
		.route({
			tags: ["IPs"],
			summary: "IP一覧取得",
			description: "登録済みのIPを一覧で取得します。",
		})
		.output(z.array(ipSchema)),

	get: oc
		.route({
			tags: ["IPs"],
			summary: "IP取得",
			description: "UUIDで指定したIPの情報を取得します。",
		})
		.input(z.object({ id: z.string().uuid() }))
		.output(ipSchema),

	create: oc
		.route({
			tags: ["IPs"],
			summary: "IP作成",
			description: "新しいIPを登録します。",
		})
		.input(
			z.object({
				name: z.string(),
				description: z.string().optional(),
			}),
		)
		.output(ipSchema),

	update: oc
		.route({
			tags: ["IPs"],
			summary: "IP更新",
			description: "UUIDで指定したIPの情報を更新します。",
		})
		.input(
			z.object({
				id: z.string().uuid(),
				data: z.object({
					name: z.string().optional(),
					description: z.string().optional(),
				}),
			}),
		)
		.output(ipSchema),

	delete: oc
		.route({
			tags: ["IPs"],
			summary: "IP削除",
			description: "UUIDで指定したIPを削除します。",
		})
		.input(z.object({ id: z.string().uuid() })),

	listForMedia: oc
		.route({
			tags: ["IPs"],
			summary: "メディアのIP一覧取得",
			description: "指定したメディアに関連付けられているIPを一覧で取得します。",
		})
		.input(z.object({ mediaId: z.string().uuid() }))
		.output(z.array(ipSchema)),

	addToMedia: oc
		.route({
			tags: ["IPs"],
			summary: "メディアにIPを追加",
			description: "指定したIPをメディアに関連付けます。",
		})
		.input(
			z.object({
				mediaId: z.string().uuid(),
				ipId: z.string().uuid(),
			}),
		),

	removeFromMedia: oc
		.route({
			tags: ["IPs"],
			summary: "メディアからIPを削除",
			description: "指定したIPとメディアの関連付けを解除します。",
		})
		.input(
			z.object({
				mediaId: z.string().uuid(),
				ipId: z.string().uuid(),
			}),
		),
};
