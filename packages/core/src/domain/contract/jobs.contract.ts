import { eventIterator, oc } from "@orpc/contract";
import { z } from "zod";
import {
	jobDtoSchema,
	jobIdRequestSchema,
	jobListRequestSchema,
	jobListResponseSchema,
} from "../jobs/schemas";
import { jobEventSchema } from "../sources/events";

export const jobsContract = {
	list: oc
		.route({
			tags: ["Jobs"],
			summary: "ジョブ一覧取得",
			description:
				"バックグラウンドジョブを指定条件で絞り込んで一覧取得します。",
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
				"失敗したバックグラウンドジョブを再実行し、更新後のジョブ情報を返します。",
		})
		.input(jobIdRequestSchema)
		.output(jobDtoSchema),
	cancel: oc
		.route({
			tags: ["Jobs"],
			summary: "ジョブキャンセル",
			description:
				"実行中または待機中のバックグラウンドジョブをキャンセルし、更新後のジョブ情報を返します。",
		})
		.input(jobIdRequestSchema)
		.output(jobDtoSchema),
	events: oc
		.route({
			tags: ["Jobs"],
			summary: "ジョブイベント購読",
			description:
				"ジョブの進捗や状態変化をリアルタイムに受け取るイベントストリームを開始します。",
		})
		.output(eventIterator(jobEventSchema)),
};
