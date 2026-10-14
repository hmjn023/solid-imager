import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	safeSourceRunSchema,
	sourceRunListSchema,
} from "../source-runs/schemas";
const id = z.object({ id: z.uuid() });
export const sourceRunsContract = {
	list: oc
		.route({ tags: ["Sources"], summary: "source操作の永続状態一覧" })
		.input(sourceRunListSchema)
		.output(
			z.object({
				items: z.array(safeSourceRunSchema),
				total: z.number().int().nonnegative(),
			}),
		),
	get: oc
		.route({ tags: ["Sources"], summary: "source操作の永続状態詳細" })
		.input(id)
		.output(safeSourceRunSchema),
	cancel: oc
		.route({ tags: ["Sources"], summary: "source操作を取消" })
		.input(id)
		.output(safeSourceRunSchema),
	retry: oc
		.route({ tags: ["Sources"], summary: "source操作を保存済み位置から再開" })
		.input(id)
		.output(safeSourceRunSchema),
};
