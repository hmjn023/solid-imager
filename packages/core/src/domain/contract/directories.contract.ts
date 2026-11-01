import { openapi } from "@orpc/openapi";
import { oc } from "@orpc/contract";
import { z } from "zod";

export const directoriesContract = {
	list: oc
		.meta(
			openapi({
				tags: ["Directories"],
				summary: "ディレクトリ一覧取得",
				description:
					"メディアソース内の指定パスにあるサブディレクトリを一覧で取得します。パスを空にするとソース直下を返します。",
			}),
		)
		.input(
			z.object({
				sourceId: z.uuid(),
				path: z.string().default(""),
			}),
		),

	create: oc
		.meta(
			openapi({
				tags: ["Directories"],
				summary: "ディレクトリ作成",
				description:
					"指定したメディアソース内のパスに新しいディレクトリを作成します。",
			}),
		)
		.input(
			z.object({
				sourceId: z.uuid(),
				path: z.string(),
				name: z.string(),
			}),
		),

	delete: oc
		.meta(
			openapi({
				tags: ["Directories"],
				summary: "ディレクトリ削除",
				description:
					"メディアソース内の指定ディレクトリを削除します。forceを指定すると、空でないディレクトリも削除対象にします。",
			}),
		)
		.input(
			z.object({
				sourceId: z.uuid(),
				path: z.string(),
				force: z.boolean().optional(),
			}),
		),

	rename: oc
		.meta(
			openapi({
				tags: ["Directories"],
				summary: "ディレクトリ移動または名前変更",
				description:
					"メディアソース内のディレクトリをoldPathからnewPathへ移動または名前変更します。",
			}),
		)
		.input(
			z.object({
				sourceId: z.uuid(),
				oldPath: z.string(),
				newPath: z.string(),
			}),
		),
};
