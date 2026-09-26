import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	newProjectSchema,
	projectSchema,
	updateProjectSchema,
} from "../projects/schemas";

export const projectsContract = {
	list: oc
		.route({
			tags: ["Projects"],
			summary: "プロジェクト一覧取得",
			description: "登録済みのプロジェクトを一覧で取得します。",
		})
		.output(z.array(projectSchema)),

	get: oc
		.route({
			tags: ["Projects"],
			summary: "プロジェクト取得",
			description: "UUIDで指定したプロジェクトの情報を取得します。",
		})
		.input(z.object({ id: z.string().uuid() }))
		.output(projectSchema),

	create: oc
		.route({
			tags: ["Projects"],
			summary: "プロジェクト作成",
			description: "新しいプロジェクトを登録します。",
		})
		.input(newProjectSchema)
		.output(projectSchema),

	update: oc
		.route({
			tags: ["Projects"],
			summary: "プロジェクト更新",
			description: "UUIDで指定したプロジェクトの情報を更新します。",
		})
		.input(
			z.object({
				id: z.string().uuid(),
				data: updateProjectSchema,
			}),
		)
		.output(projectSchema),

	delete: oc
		.route({
			tags: ["Projects"],
			summary: "プロジェクト削除",
			description: "UUIDで指定したプロジェクトを削除します。",
		})
		.input(z.object({ id: z.string().uuid() })),

	listForMedia: oc
		.route({
			tags: ["Projects"],
			summary: "メディアのプロジェクト一覧取得",
			description:
				"指定したメディアに関連付けられているプロジェクトを一覧で取得します。",
		})
		.input(z.object({ mediaId: z.string().uuid() }))
		.output(z.array(projectSchema)),

	addToMedia: oc
		.route({
			tags: ["Projects"],
			summary: "メディアにプロジェクトを追加",
			description: "指定したプロジェクトをメディアに関連付けます。",
		})
		.input(
			z.object({
				mediaId: z.string().uuid(),
				projectId: z.string().uuid(),
			}),
		),

	removeFromMedia: oc
		.route({
			tags: ["Projects"],
			summary: "メディアからプロジェクトを削除",
			description: "指定したプロジェクトとメディアの関連付けを解除します。",
		})
		.input(
			z.object({
				mediaId: z.string().uuid(),
				projectId: z.string().uuid(),
			}),
		),
};
