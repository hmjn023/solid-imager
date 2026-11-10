import { openapi } from "@orpc/openapi";
import { asyncIteratorObject, oc } from "@orpc/contract";
import { z } from "zod";
import {
	jobDtoSchema,
	jobIdRequestSchema,
	jobListRequestSchema,
	jobListResponseSchema,
} from "../jobs/schemas";
import { jobEventSchema } from "../sources/events";

export const jobsContract = {
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
					"バックグラウンドジョブを指定条件で絞り込んで一覧取得します。",
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
					"失敗した単独の実行ジョブを再実行します。バッチ親子とインポート受付は対象外です。失敗項目は新しいバッチとして開始してください。",
			}),
		)
		.input(jobIdRequestSchema)
		.output(jobDtoSchema),
	cancel: oc
		.meta(
			openapi({
				tags: ["Jobs"],
				summary: "ジョブキャンセル",
				description:
					"待機中は取消を確定し、実行中は取消を要求します。取消要求は非終端イベント、取消確定は終端イベントとして通知します。",
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
