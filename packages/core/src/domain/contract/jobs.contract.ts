import { eventIterator, oc } from "@orpc/contract";
import { z } from "zod";
import {
	jobDtoSchema,
	jobIdRequestSchema,
	jobListRequestSchema,
	jobListResponseSchema,
	jobRetryFailedRequestSchema,
	jobRetryFailedResponseSchema,
} from "../jobs/schemas";
import { jobEventSchema } from "../sources/events";

export const jobsContract = {
	list: oc
		.route({
			tags: ["Jobs"],
			summary: "ジョブ一覧取得",
			description:
				"バックグラウンドジョブを全件から状態で絞り込んだ後にページ分割して一覧取得します。active は待機中と実行中をまとめて返します。total は絞り込み後の件数です。",
		})
		.input(jobListRequestSchema)
		.output(jobListResponseSchema),
	get: oc
		.route({
			tags: ["Jobs"],
			summary: "ジョブ詳細取得",
			description:
				"UUIDで指定したバックグラウンドジョブの状態と詳細を取得します。",
		})
		.input(jobIdRequestSchema)
		.output(jobDtoSchema),
	downloadArtifact: oc
		.route({
			tags: ["Jobs"],
			summary: "ジョブ成果物ダウンロード",
			description:
				"完了したジョブが生成した成果物をストリームとしてダウンロードします。成果物のないジョブでは取得できません。",
		})
		.input(jobIdRequestSchema)
		.output(z.instanceof(ReadableStream)),
	retry: oc
		.route({
			tags: ["Jobs"],
			summary: "ジョブ再実行",
			description:
				"失敗した処理や再開可能なbatch親を再試行し、更新後の情報を返します。batch親の再開は完了済みを保持し、未投入・未完了の対象を再開します。承認待ちは対象外です。",
		})
		.input(jobIdRequestSchema)
		.output(jobDtoSchema),
	retryFailed: oc
		.route({
			tags: ["Jobs"],
			summary: "失敗した処理をページ横断で再試行",
			description:
				"再試行可能な処理を少数ずつ再開します。返されたcursorで次を取得し、nullで完了します。batchは親単位で失敗・未投入項目をまとめて再開し、完了・取消・保留項目を保持します。",
		})
		.input(jobRetryFailedRequestSchema)
		.output(jobRetryFailedResponseSchema),
	cancel: oc
		.route({
			tags: ["Jobs"],
			summary: "ジョブキャンセル",
			description:
				"実行中または待機中のバックグラウンドジョブをキャンセルし、更新後のジョブ情報を返します。batchの待機中・実行中の子を指定した場合は、親batchの残り全体をキャンセルします。完了済みと独立・共有要求は保持します。",
		})
		.input(jobIdRequestSchema)
		.output(jobDtoSchema),
	delete: oc
		.route({
			tags: ["Jobs"],
			summary: "終了したジョブの履歴を削除",
			description:
				"終了した処理をJobsの一覧から除外します。batchは親子まとめて対象になり、メディア・処理結果・実行状態は保持します。待機中・実行中は先にキャンセルが必要です。",
		})
		.input(jobIdRequestSchema)
		.output(z.object({ success: z.literal(true) })),
	events: oc
		.route({
			tags: ["Jobs"],
			summary: "ジョブイベント購読",
			description:
				"ジョブの進捗や状態変化をリアルタイムに受け取るイベントストリームを開始します。",
		})
		.output(eventIterator(jobEventSchema)),
};
