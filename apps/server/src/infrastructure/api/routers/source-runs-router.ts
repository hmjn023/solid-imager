import { implement, ORPCError } from "@orpc/server";
import { sourceRunsContract } from "@solid-imager/core/domain/contract/source-runs.contract";
import { SourceRunRepository } from "~/infrastructure/repositories/source-run-repository";
import { sourceRunService } from "~/infrastructure/services/source-run-service";
import { mutateSourceRun, toSafeSourceRun } from "../source-run-view";
const os = implement(sourceRunsContract);
export const sourceRunsRouter = os.router({
	list: os.list.handler(async ({ input }) => {
		await sourceRunService.initialize();
		const page = await SourceRunRepository.list(input);
		return { items: page.items.map(toSafeSourceRun), total: page.total };
	}),
	get: os.get.handler(async ({ input }) => {
		await sourceRunService.initialize();
		const run = await SourceRunRepository.findById(input.id);
		if (!run)
			throw new ORPCError("NOT_FOUND", {
				message: "Source operation not found",
			});
		return toSafeSourceRun(run);
	}),
	cancel: os.cancel.handler(async ({ input }) =>
		toSafeSourceRun(await mutateSourceRun("cancel", input.id)),
	),
	retry: os.retry.handler(async ({ input }) =>
		toSafeSourceRun(await mutateSourceRun("retry", input.id)),
	),
});
