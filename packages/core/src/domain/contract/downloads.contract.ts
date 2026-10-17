import { oc } from "@orpc/contract";
import { z } from "zod";
import { bulkDownloadRequestSchema } from "../media/schemas";
import {
	safeDownloadRunSchema,
	downloadListRequestSchema,
	downloadListResponseSchema,
} from "../downloads/schemas";

export const downloadsContract = {
	start: oc
		.route({
			tags: ["Downloads"],
			summary: "一括ダウンロードの開始",
			description:
				"専用download runを予約します。同じ入力のactive runはまとめ、予約ID・開始件数・スキップ件数を返します。",
		})
		.input(bulkDownloadRequestSchema)
		.output(
			z.object({
				success: z.boolean(),
				jobCount: z.number(),
				skippedCount: z.number(),
				message: z.string(),
				runIds: z.array(z.uuid()),
			}),
		),
	list: oc
		.route({
			tags: ["Downloads"],
			summary: "ダウンロード履歴一覧",
			description:
				"専用runの状態をDBから取得します。認証情報・local path・lease token・checkpointは返しません。",
		})
		.input(downloadListRequestSchema)
		.output(downloadListResponseSchema),
	get: oc
		.route({ tags: ["Downloads"], summary: "ダウンロード状態取得" })
		.input(z.object({ id: z.uuid() }))
		.output(safeDownloadRunSchema),
	retry: oc
		.route({
			tags: ["Downloads"],
			summary: "失敗したダウンロードの再試行",
			description:
				"保存された完成ファイルのcheckpointを維持し、失敗runの未完了処理を予約します。",
		})
		.input(z.object({ id: z.uuid() }))
		.output(safeDownloadRunSchema),
	cancel: oc
		.route({
			tags: ["Downloads"],
			summary: "ダウンロード取消",
			description:
				"pendingは取消し、実行中は取消要求を保存します。旧attemptの公開・登録・結果更新は拒否します。",
		})
		.input(z.object({ id: z.uuid() }))
		.output(safeDownloadRunSchema),
};
