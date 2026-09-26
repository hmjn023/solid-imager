import { oc } from "@orpc/contract";
import { AppConfigSchema } from "../config/config-schema";

export const configContract = {
	get: oc
		.route({
			tags: ["Configuration"],
			summary: "アプリ設定取得",
			description: "現在保存されているアプリケーション設定を取得します。",
		})
		.output(AppConfigSchema),

	update: oc
		.route({
			tags: ["Configuration"],
			summary: "アプリ設定更新",
			description:
				"指定した項目でアプリケーション設定を更新し、更新後の設定を返します。",
		})
		.input(AppConfigSchema.partial())
		.output(AppConfigSchema),
};
