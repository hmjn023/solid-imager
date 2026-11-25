import { openapi } from "@orpc/openapi";
import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	newProjectSchema,
	projectSchema,
	updateProjectSchema,
} from "../projects/schemas";

export const projectsContract = {
	list: oc
		.meta(
			openapi({
				method: "GET",
				path: "/projects",
				tags: ["Projects"],
				summary: "プロジェクト一覧取得",
				description: "登録済みのプロジェクトを一覧で取得します。",
			}),
		)
		.output(z.array(projectSchema)),

	get: oc
		.meta(
			openapi({
				method: "GET",
				path: "/projects/{id}",
				tags: ["Projects"],
				summary: "プロジェクト取得",
				description: "UUIDで指定したプロジェクトの情報を取得します。",
			}),
		)
		.input(z.object({ id: z.uuid() }))
		.output(projectSchema),

	create: oc
		.meta(
			openapi({
				method: "POST",
				path: "/projects",
				tags: ["Projects"],
				summary: "プロジェクト作成",
				description: "新しいプロジェクトを登録します。",
			}),
		)
		.input(newProjectSchema)
		.output(projectSchema),

	update: oc
		.meta(
			openapi({
				method: "PATCH",
				path: "/projects/{id}",
				tags: ["Projects"],
				summary: "プロジェクト更新",
				description: "UUIDで指定したプロジェクトの情報を更新します。",
			}),
		)
		.input(
			z.object({
				id: z.uuid(),
				data: updateProjectSchema,
			}),
		)
		.output(projectSchema),

	delete: oc
		.meta(
			openapi({
				method: "DELETE",
				path: "/projects/{id}",
				tags: ["Projects"],
				summary: "プロジェクト削除",
				description: "UUIDで指定したプロジェクトを削除します。",
			}),
		)
		.input(z.object({ id: z.uuid() })),

	listForMedia: oc
		.meta(
			openapi({
				method: "GET",
				path: "/media/{mediaId}/projects",
				tags: ["Projects"],
				summary: "メディアのプロジェクト一覧取得",
				description:
					"指定したメディアに関連付けられているプロジェクトを一覧で取得します。",
			}),
		)
		.input(z.object({ mediaId: z.uuid() }))
		.output(z.array(projectSchema)),

	addToMedia: oc
		.meta(
			openapi({
				method: "PUT",
				path: "/media/{mediaId}/projects/{projectId}",
				tags: ["Projects"],
				summary: "メディアにプロジェクトを追加",
				description: "指定したプロジェクトをメディアに関連付けます。",
			}),
		)
		.input(
			z.object({
				mediaId: z.uuid(),
				projectId: z.uuid(),
			}),
		),

	removeFromMedia: oc
		.meta(
			openapi({
				method: "DELETE",
				path: "/media/{mediaId}/projects/{projectId}",
				tags: ["Projects"],
				summary: "メディアからプロジェクトを削除",
				description: "指定したプロジェクトとメディアの関連付けを解除します。",
			}),
		)
		.input(
			z.object({
				mediaId: z.uuid(),
				projectId: z.uuid(),
			}),
		),
};
