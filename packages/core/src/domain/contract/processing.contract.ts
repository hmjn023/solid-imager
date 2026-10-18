import { oc } from "@orpc/contract";
import {
	processingListRequestSchema,
	processingListResponseSchema,
	processingMediaRequestSchema,
	processingRetryRequestSchema,
	safeMediaProcessingSchema,
	processingRequestStepSchema,
	processingRecoveryRequestSchema,
	processingRecoveryResponseSchema,
} from "../processing/schemas";

export const processingContract = {
	scanRecovery: oc
		.route({
			tags: ["Processing"],
			summary: "未完了工程の検査",
			description:
				"100件以下ずつ検査し、未要求・失敗・古い要求・成果物欠損・需要を失った待機要求を返します。実行中・予約済み・正常完了は除外します。cursorがnullになるまで継続します。",
		})
		.input(processingRecoveryRequestSchema)
		.output(processingRecoveryResponseSchema),
	enqueueRecovery: oc
		.route({
			tags: ["Processing"],
			summary: "未完了工程の補修投入",
			description:
				"検査と再確認を行い、100件以下の固定対象batchへ予約します。metadata・thumbnail・tagging・ccipに対応し、正常完了や既存の実行を保持します。cursorで全ページを継続できます。",
		})
		.input(processingRecoveryRequestSchema)
		.output(processingRecoveryResponseSchema),
	request: oc
		.route({
			tags: ["Processing"],
			summary: "未要求・古い工程の投入",
			description:
				"観測した要求ID（未要求はnull）を照合し、未要求・古い要求・失敗した工程だけを現在の入力で予約します。",
		})
		.input(processingRequestStepSchema)
		.output(safeMediaProcessingSchema),
	list: oc
		.route({
			tags: ["Processing"],
			summary: "メディア処理状態一覧",
			description:
				"ローカルメディアの工程別要求を検索・状態条件で絞り込み、DBから現在の処理状態を取得します。",
		})
		.input(processingListRequestSchema)
		.output(processingListResponseSchema),
	get: oc
		.route({
			tags: ["Processing"],
			summary: "メディア処理状態取得",
			description:
				"4工程の要求状態、入力の鮮度、試行回数、公開可能な失敗分類を取得します。",
		})
		.input(processingMediaRequestSchema)
		.output(safeMediaProcessingSchema),
	retry: oc
		.route({
			tags: ["Processing"],
			summary: "失敗工程の再試行",
			description:
				"指定した要求が現在も失敗状態の場合に、その工程だけ現在の入力で再予約します。他工程や新しい要求は変更しません。",
		})
		.input(processingRetryRequestSchema)
		.output(safeMediaProcessingSchema),
};
