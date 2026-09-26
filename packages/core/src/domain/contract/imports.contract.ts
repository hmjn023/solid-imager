import { eventIterator, oc } from "@orpc/contract";
import { z } from "zod";
import {
	downloadItemSchema,
	pendingImportCountSchema,
	pendingImportJobSchema,
} from "../media/schemas";
import { importEventSchema } from "../sources/events";

export const importsContract = {
	bulkAdd: oc
		.route({
			tags: ["Imports"],
			summary: "インポート項目の一括登録",
			description:
				"ダウンロード情報などの項目をインポート待ちリストへまとめて追加します。",
		})
		.input(z.object({ items: z.array(downloadItemSchema) })),

	listPending: oc
		.route({
			tags: ["Imports"],
			summary: "保留中インポート一覧取得",
			description: "処理待ちになっているインポートジョブを一覧で取得します。",
		})
		.output(z.array(pendingImportJobSchema)),

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
				"指定したインポートジョブを対象メディアソースへ取り込み、処理結果と件数を返します。",
		})
		.input(
			z.object({
				jobIds: z.array(z.string().uuid()),
				targetSourceId: z.string().uuid(),
			}),
		)
		.output(z.object({ success: z.boolean(), processedCount: z.number() })),

	cancel: oc
		.route({
			tags: ["Imports"],
			summary: "インポート処理のキャンセル",
			description: "指定したインポートジョブをキャンセルします。",
		})
		.input(z.object({ jobIds: z.array(z.string().uuid()) }))
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
