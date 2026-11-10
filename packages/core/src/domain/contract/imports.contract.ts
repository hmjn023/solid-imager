import { openapi } from "@orpc/openapi";
import { asyncIteratorObject, oc } from "@orpc/contract";
import { z } from "zod";
import {
	downloadItemSchema,
	pendingImportCountSchema,
	pendingImportJobSchema,
} from "../media/schemas";
import { importEventSchema } from "../sources/events";

export const importsContract = {
	bulkAdd: oc
		.meta(
			openapi({
				tags: ["Imports"],
				summary: "インポート項目の一括登録",
				description:
					"ダウンロード情報などの項目をインポート待ちリストへまとめて追加します。",
			}),
		)
		.input(z.object({ items: z.array(downloadItemSchema) })),

	listPending: oc
		.meta(
			openapi({
				tags: ["Imports"],
				summary: "保留中インポート一覧取得",
				description: "処理待ちになっているインポートジョブを一覧で取得します。",
			}),
		)
		.output(z.array(pendingImportJobSchema)),

	countPending: oc
		.meta(
			openapi({
				tags: ["Imports"],
				summary: "保留中インポート件数取得",
				description: "現在処理待ちになっているインポート項目数を取得します。",
			}),
		)
		.output(pendingImportCountSchema),

	process: oc
		.meta(
			openapi({
				tags: ["Imports"],
				summary: "インポート処理の実行",
				description:
					"pendingのインポート受付のみを承認し、download投入と受付の確定を同じトランザクションで保存します。再送で同じ受付を二重投入しません。",
			}),
		)
		.input(
			z.object({
				jobIds: z.array(z.uuid()),
				targetSourceId: z.uuid(),
			}),
		)
		.output(z.object({ success: z.boolean(), processedCount: z.number() })),

	cancel: oc
		.meta(
			openapi({
				tags: ["Imports"],
				summary: "インポート処理のキャンセル",
				description:
					"pendingのインポート受付のみを取り消します。投入済み受付や他の種類のジョブは変更しません。",
			}),
		)
		.input(z.object({ jobIds: z.array(z.uuid()) }))
		.output(z.object({ success: z.boolean() })),

	events: oc
		.meta(
			openapi({
				tags: ["Imports"],
				summary: "インポートイベント購読",
				description:
					"インポート処理の進捗や状態変化をリアルタイムに受け取るイベントストリームを開始します。",
			}),
		)
		.output(asyncIteratorObject(importEventSchema)),
};
