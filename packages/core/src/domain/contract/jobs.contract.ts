import { openapi } from "@orpc/openapi";
import { asyncIteratorObject, oc } from "@orpc/contract";
import { z } from "zod";
import {
	jobDtoSchema,
	batchTargetsInputSchema,
	batchTargetsSchema,
	jobIdRequestSchema,
	retryJobRequestSchema,
	jobListRequestSchema,
	jobListResponseSchema,
} from "../jobs/schemas";
import { jobEventSchema } from "../sources/events";

export const jobsContract = {
	types: oc
		.meta(openapi({ tags: ["Jobs"], summary: "ジョブ一覧で選択できる種類" }))
		.output(z.array(z.string())),
	targets: oc
		.meta(openapi({ tags: ["Jobs"], summary: "バッチの処理対象一覧" }))
		.input(batchTargetsInputSchema)
		.output(batchTargetsSchema),
	activeBatches: oc
		.meta(openapi({ tags: ["Jobs"], summary: "Managerの実行中バッチ一覧" }))
		.input(z.object({}))
		.output(z.array(jobDtoSchema)),
	list: oc
		.meta(
			openapi({
				tags: ["Jobs"],
				summary: "ジョブ一覧取得",
				description:
					"バックグラウンドジョブを指定条件で絞り込み、実行中・待機中・履歴の順に取得します。実行中と待機中は並列処理群、タグ付け、Embedding、CCIPの順で、履歴は終了日時の新しい順に並びます。",
			}),
		)
		.input(jobListRequestSchema)
		.output(jobListResponseSchema),
	get: oc
		.meta(
			openapi({
				tags: ["Jobs"],
				summary: "ジョブ詳細取得",
				description:
					"UUIDで指定したバックグラウンドジョブの状態と詳細を取得します。",
			}),
		)
		.input(jobIdRequestSchema)
		.output(jobDtoSchema),
	downloadArtifact: oc
		.meta(
			openapi({
				tags: ["Jobs"],
				summary: "ジョブ成果物ダウンロード",
				description:
					"完了したジョブが生成した成果物をストリームとしてダウンロードします。成果物のないジョブでは取得できません。",
			}),
		)
		.input(jobIdRequestSchema)
		.output(
			z.instanceof(ReadableStream).meta({
				type: "string",
				format: "binary",
				contentMediaType: "application/octet-stream",
			}),
		),
	retry: oc
		.meta(
			openapi({
				tags: ["Jobs"],
				summary: "ジョブ再実行",
				description:
					"一括取り込み・EmbeddingGemmaの親ジョブは対象別の失敗工程を再投入します。単独ジョブは失敗したジョブを再実行します。",
			}),
		)
		.input(retryJobRequestSchema)
		.output(jobDtoSchema),
	cancel: oc
		.meta(
			openapi({
				tags: ["Jobs"],
				summary: "ジョブキャンセル",
				description:
					"一括取り込みではその親に属する待機工程を取り消し、実行中の工程に取消を要求します。単独ジョブにも同じ待機・実行中の規則を適用します。取消要求は非終端イベント、取消確定は終端イベントとして通知します。",
			}),
		)
		.input(jobIdRequestSchema)
		.output(jobDtoSchema),
	events: oc
		.meta(
			openapi({
				tags: ["Jobs"],
				summary: "ジョブイベント購読",
				description:
					"ジョブの進捗や状態変化をリアルタイムに受け取るイベントストリームを開始します。",
			}),
		)
		.output(asyncIteratorObject(jobEventSchema)),
};
