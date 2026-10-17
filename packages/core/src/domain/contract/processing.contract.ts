import { oc } from "@orpc/contract";
import {
	processingListRequestSchema,
	processingListResponseSchema,
	processingMediaRequestSchema,
	processingRetryRequestSchema,
	safeMediaProcessingSchema,
} from "../processing/schemas";

export const processingContract = {
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
