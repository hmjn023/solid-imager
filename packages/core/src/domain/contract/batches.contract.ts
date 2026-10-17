import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	batchListRequestSchema,
	batchItemListRequestSchema,
	safeBatchRunSchema,
	safeBatchItemSchema,
	safeBatchAttemptSchema,
	batchInputSchema,
} from "../batches/schemas";
const idSchema = z.object({ id: z.uuid() });
export const batchesContract = {
	start: oc
		.route({ tags: ["Batches"], summary: "固定対象batchを開始" })
		.input(
			batchInputSchema.extend({
				kind: z.enum(["tagging", "ccip", "thumbnail"]),
			}),
		)
		.output(safeBatchRunSchema),
	attempts: oc
		.route({ tags: ["Batches"], summary: "batch項目の試行履歴" })
		.input(batchItemListRequestSchema)
		.output(
			z.object({
				items: z.array(safeBatchAttemptSchema),
				total: z.number().int().nonnegative(),
			}),
		),
	list: oc
		.route({ tags: ["Batches"], summary: "固定対象batch一覧" })
		.input(batchListRequestSchema)
		.output(
			z.object({
				items: z.array(safeBatchRunSchema),
				total: z.number().int().nonnegative(),
			}),
		),
	get: oc
		.route({ tags: ["Batches"], summary: "固定対象batch詳細" })
		.input(idSchema)
		.output(safeBatchRunSchema),
	items: oc
		.route({ tags: ["Batches"], summary: "batch対象と履歴の結果" })
		.input(batchItemListRequestSchema)
		.output(
			z.object({
				items: z.array(safeBatchItemSchema),
				total: z.number().int().nonnegative(),
			}),
		),
	cancel: oc
		.route({ tags: ["Batches"], summary: "batch未完了項目を取消" })
		.input(idSchema)
		.output(safeBatchRunSchema),
	retry: oc
		.route({ tags: ["Batches"], summary: "batch未完了項目を再開" })
		.input(idSchema)
		.output(safeBatchRunSchema),
};
