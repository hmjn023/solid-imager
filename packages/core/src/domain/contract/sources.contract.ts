import { eventIterator, oc } from "@orpc/contract";
import { z } from "zod";
import { jobDtoSchema } from "../jobs/schemas";
import { sourceEventSchema } from "../sources/events";
import {
	mediaSourceInfoSchema,
	mediaSourceStatusSchema,
	safeMediaSourceSchema,
} from "../sources/schemas";

const sourceSyncResultSchema = z.discriminatedUnion("success", [
	z.object({
		id: z.string().uuid(),
		success: z.literal(true),
		sourceId: z.string().uuid(),
		added: z.number().int().nonnegative(),
		deleted: z.number().int().nonnegative(),
	}),
	z.object({
		id: z.string().uuid(),
		success: z.literal(false),
		error: z.string(),
	}),
]);

export type SourceSyncResult = z.infer<typeof sourceSyncResultSchema>;

export const sourcesContract = {
	list: oc
		.route({
			tags: ["Media Sources"],
			summary: "メディアソース一覧取得",
			description:
				"登録されているメディアソースの一覧を取得します。接続情報に含まれる機密情報は除外されます。",
		})
		.output(z.array(safeMediaSourceSchema)),

	get: oc
		.route({
			tags: ["Media Sources"],
			summary: "メディアソース取得",
			description:
				"UUIDで指定したメディアソースの情報を取得します。機密情報はレスポンスから除外されます。",
		})
		.input(z.object({ id: z.string().uuid() }))
		.output(safeMediaSourceSchema),

	create: oc
		.route({
			tags: ["Media Sources"],
			summary: "メディアソース作成",
			description: "ローカル、SFTP、S3などのメディアソースを新規登録します。",
		})
		.input(mediaSourceInfoSchema)
		.output(safeMediaSourceSchema),

	update: oc
		.route({
			tags: ["Media Sources"],
			summary: "メディアソース更新",
			description:
				"UUIDで指定したメディアソースの接続設定や表示情報を更新します。",
		})
		.input(
			z.object({
				id: z.string().uuid(),
				data: mediaSourceInfoSchema.partial(),
			}),
		)
		.output(safeMediaSourceSchema),

	delete: oc
		.route({
			tags: ["Media Sources"],
			summary: "メディアソース削除",
			description:
				"メディアソースを登録から削除し、そのソースのファイル監視を停止します。",
		})
		.input(z.object({ id: z.string().uuid() }))
		.output(z.object({ success: z.boolean() })),

	sync: oc
		.route({
			tags: ["Media Sources"],
			summary: "メディアソース同期",
			description:
				"指定したメディアソースを走査し、ファイルシステムとデータベースの登録内容を同期します。追加・削除された項目ごとの結果を返します。",
		})
		.input(z.object({ ids: z.array(z.string().uuid()) }))
		.output(
			z.object({
				results: z.array(sourceSyncResultSchema),
			}),
		),

	enqueueExport: oc
		.route({
			tags: ["Media Sources"],
			summary: "メディアソースのエクスポート開始",
			description:
				"指定したメディアソースのデータをNDJSONまたはtar形式で出力するバックグラウンドジョブを開始します。tar形式では画像を含めることもできます。",
		})
		.input(
			z.object({
				id: z.string().uuid(),
				mode: z.enum(["ndjson", "tar"]).default("ndjson"),
				includeImages: z.boolean().default(false),
			}),
		)
		.output(jobDtoSchema),

	enqueueImport: oc
		.route({
			tags: ["Media Sources"],
			summary: "メディアソースのインポート開始",
			description:
				"NDJSONまたはtar形式のファイルを指定したメディアソースへ取り込むバックグラウンドジョブを開始します。",
		})
		.input(
			z.object({
				id: z.string().uuid(),
				mode: z.enum(["ndjson", "tar"]),
				file: z.instanceof(File),
			}),
		)
		.output(jobDtoSchema),

	status: oc
		.route({
			tags: ["Media Sources"],
			summary: "メディアソース状態取得",
			description:
				"メディアソースの走査状態、進捗、ファイル数などの統計情報を取得します。",
		})
		.input(z.object({ id: z.string().uuid() }))
		.output(mediaSourceStatusSchema),

	events: oc
		.route({
			tags: ["Media Sources"],
			summary: "メディアソースイベント購読",
			description:
				"指定したメディアソース、または全ソースの状態変化をリアルタイムに受け取るイベントストリームを開始します。",
		})
		.input(z.object({ id: z.string().uuid().or(z.literal("*")) }))
		.output(eventIterator(sourceEventSchema)),
};
