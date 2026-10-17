import { eventIterator, oc } from "@orpc/contract";
import { z } from "zod";
import { downloadItemSchema, pendingImportCountSchema } from "../media/schemas";
import { importEventSchema } from "../sources/events";
import {
	safePendingImportRequestSchema,
	importBulkAddResultSchema,
} from "../imports/schemas";

export const importsContract = {
	bulkAdd: oc
		.route({
			tags: ["Imports"],
			summary: "インポート項目の一括登録",
			description:
				"ダウンロード情報などの項目をインポート待ちリストへまとめて追加します。",
		})
		.input(z.object({ items: z.array(downloadItemSchema) }))
		.output(importBulkAddResultSchema),

	listPending: oc
		.route({
			tags: ["Imports"],
			summary: "保留中インポート一覧取得",
			description:
				"専用tableの承認待ち要求を取得します。cookie等の認証情報は返しません。",
		})
		.output(z.array(safePendingImportRequestSchema)),

	countPending: oc
		.route({
			tags: ["Imports"],
			summary: "保留中インポート件数取得",
			description: "現在処理待ちになっているインポート項目数を取得します。",
		})
		.output(pendingImportCountSchema),

	process: oc
		.route({
			tags: ["Imports"],
			summary: "インポート処理の実行",
			description:
				"承認待ち要求をローカルsourceへ承認し、download予約と同時に保存します。jobIdsは互換名で、専用requestのIDを指定します。重複承認は再投入しません。",
		})
		.input(
			z.object({
				jobIds: z.array(z.uuid()),
				targetSourceId: z.uuid(),
			}),
		)
		.output(z.object({ success: z.boolean(), processedCount: z.number() })),

	cancel: oc
		.route({
			tags: ["Imports"],
			summary: "インポート処理のキャンセル",
			description:
				"承認待ち要求だけを取消します。承認済み要求や汎用jobは変更しません。jobIdsは専用request IDの互換名です。",
		})
		.input(z.object({ jobIds: z.array(z.uuid()) }))
		.output(z.object({ success: z.boolean() })),

	events: oc
		.route({
			tags: ["Imports"],
			summary: "インポートイベント購読",
			description:
				"インポート処理の進捗や状態変化をリアルタイムに受け取るイベントストリームを開始します。",
		})
		.output(eventIterator(importEventSchema)),
};
