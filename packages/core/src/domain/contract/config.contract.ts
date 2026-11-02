import { openapi } from "@orpc/openapi";
import { oc } from "@orpc/contract";
import { z } from "zod";
import { mcpToolInfoSchema, webToolInfoSchema } from "../config/mcp";
import {
	AppConfigSchema,
	AppConfigUpdateSchema,
} from "../config/config-schema";

export const configContract = {
	mcpCatalog: oc
		.meta(openapi({ tags: ["Configuration"], summary: "MCP 公開候補一覧" }))
		.output(z.array(mcpToolInfoSchema)),
	webTools: oc
		.meta(
			openapi({ tags: ["Configuration"], summary: "公開中の WebMCP ツール" }),
		)
		.output(z.array(webToolInfoSchema)),
	callWebTool: oc
		.meta(
			openapi({
				tags: ["Configuration"],
				summary: "公開中の WebMCP データ操作を実行",
			}),
		)
		.input(
			z.object({
				name: z.string(),
				arguments: z.record(z.string(), z.unknown()),
			}),
		)
		.output(z.unknown()),
	get: oc
		.meta(
			openapi({
				tags: ["Configuration"],
				summary: "アプリ設定取得",
				description: "現在保存されているアプリケーション設定を取得します。",
			}),
		)
		.output(AppConfigSchema),

	update: oc
		.meta(
			openapi({
				tags: ["Configuration"],
				summary: "アプリ設定更新",
				description:
					"指定した項目でアプリケーション設定を更新し、更新後の設定を返します。",
			}),
		)
		.input(AppConfigUpdateSchema)
		.output(AppConfigSchema),
};
