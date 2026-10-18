import type {
	ProcessingRecoveryRequest,
	ProcessingRecoveryResponse,
} from "@solid-imager/core/domain/processing/schemas";
import { createProcessingManagementRepository } from "@solid-imager/db/repositories/processing-management-repository";
import { getExecutor } from "~/infrastructure/db/executor";
import { createProcessingRecoveryInspector } from "~/infrastructure/jobs/processing-recovery-targets";
import { batchRunService } from "./batch-run-service";

/** Each call scans at most 100 inputs and captures a small durable batch, never all IDs in memory. */
export async function recoverProcessingPage(
	input: ProcessingRecoveryRequest,
	enqueue: boolean,
): Promise<ProcessingRecoveryResponse> {
	await batchRunService.initialize();
	const page =
		await createProcessingManagementRepository(getExecutor).scanPage(input);
	const matches = await createProcessingRecoveryInspector()(
		page.items,
		input.kind,
	);
	const summary =
		enqueue && matches.length
			? await batchRunService.start({
					kind: input.kind,
					mediaIds: matches.map(({ target }) => target.input.mediaId),
					recovery: true,
					force: false,
					missingOnly: false,
					thumbnailSize: 512,
				})
			: null;
	return {
		scanned: page.items.length,
		items: matches.map(({ target, reason }) => ({
			mediaId: target.input.mediaId,
			fileName: target.fileName,
			sourceName: target.sourceName,
			reason,
		})),
		queued: summary?.progress.total ?? 0,
		jobId: summary?.progress.total ? summary.run.id : null,
		cursor: page.cursor,
	};
}
