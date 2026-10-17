import { implement, ORPCError } from "@orpc/server";
import { batchesContract } from "@solid-imager/core/domain/contract/batches.contract";
import { toSafeBatchRun } from "@solid-imager/application/services/batch-run-service";
import { safeBatchItemSchema } from "@solid-imager/core/domain/batches/schemas";
import { BatchRunRepository } from "~/infrastructure/repositories/batch-run-repository";
import { batchRunService } from "~/infrastructure/services/batch-run-service";
import { mutateBatchJob } from "../batch-job-view";
const os = implement(batchesContract);
async function required(id: string) {
	await batchRunService.initialize();
	const summary = await BatchRunRepository.findById(id);
	if (!summary)
		throw new ORPCError("NOT_FOUND", { message: "Batch not found" });
	return toSafeBatchRun(summary);
}
export const batchesRouter = os.router({
	start: os.start.handler(async ({ input }) =>
		toSafeBatchRun(await batchRunService.start(input)),
	),
	attempts: os.attempts.handler(async ({ input }) => {
		await batchRunService.initialize();
		if (!(await BatchRunRepository.findItem(input.id)))
			throw new ORPCError("NOT_FOUND", { message: "Batch item not found" });
		return BatchRunRepository.listAttempts(input.id, input.limit, input.offset);
	}),
	list: os.list.handler(async ({ input }) => {
		await batchRunService.initialize();
		const page = await BatchRunRepository.list(input);
		return { items: page.items.map(toSafeBatchRun), total: page.total };
	}),
	get: os.get.handler(({ input }) => required(input.id)),
	items: os.items.handler(async ({ input }) => {
		await required(input.id);
		const page = await BatchRunRepository.listItems(
			input.id,
			input.limit,
			input.offset,
		);
		return {
			items: page.items.map((item) =>
				safeBatchItemSchema.parse({
					...item,
					failureCode: item.failureCode
						? ["processing_failed", "input_changed"].includes(item.failureCode)
							? item.failureCode
							: "legacy_blocked"
						: null,
				}),
			),
			total: page.total,
		};
	}),
	cancel: os.cancel.handler(async ({ input }) => {
		await mutateBatchJob("cancel", input.id);
		return required(input.id);
	}),
	retry: os.retry.handler(async ({ input }) => {
		await mutateBatchJob("retry", input.id);
		return required(input.id);
	}),
});
