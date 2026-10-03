import { oc } from "@orpc/contract";
import { z } from "zod";
import { bulkDownloadRequestSchema } from "../media/schemas";

export const downloadsContract = {
	start: oc
		.route({
			tags: ["Downloads"],
			summary: "一括ダウンロードの開始",
			description:
				"指定されたダウンロード項目を処理するバックグラウンドジョブを作成します。開始件数、スキップ件数、結果メッセージを返します。",
		})
		.input(bulkDownloadRequestSchema)
		.output(
			z.object({
				success: z.boolean(),
				jobCount: z.number(),
				skippedCount: z.number(),
				message: z.string(),
			}),
		),
};
