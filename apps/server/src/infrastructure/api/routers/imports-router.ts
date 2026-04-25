import { os } from "@orpc/server";
import {
	createImportRequestService,
	type ImportRequestEventName,
} from "@solid-imager/application/services/import-request-service";
import { downloadItemSchema } from "@solid-imager/core/domain/media/schemas";
import { z } from "zod";
import { queueDownloadJobs } from "~/infrastructure/jobs/download-jobs";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { JobRepository } from "~/infrastructure/repositories/job-repository";

const importRequestService = createImportRequestService({
	jobRepository: new JobRepository(),
	findMediaSourceForFile: async (filePath) => {
		const { BackupService } = await import(
			"~/application/services/backup-service"
		);
		return await BackupService.findMediaSourceForFile(filePath);
	},
	restoreSource: async (sourceId, items) => {
		const { BackupService } = await import(
			"~/application/services/backup-service"
		);
		return await BackupService.restoreSource(sourceId, items);
	},
	executeImport: async (targetSourceId, items) => {
		await queueDownloadJobs(targetSourceId, items);
		return { processedCount: items.length };
	},
	publishImportEvent: (event, payload) => {
		SseManager.sendEvent("global-imports", event, payload);
	},
});

export const bulkAddHandler = async ({
	input,
}: {
	input: { items: z.infer<typeof downloadItemSchema>[] };
}) => {
	return await importRequestService.bulkAddImportItems(input.items);
};

export const importsRouter = {
	bulkAdd: os
		.input(z.object({ items: z.array(downloadItemSchema) }))
		.handler(bulkAddHandler),

	listPending: os.handler(async () => {
		return await importRequestService.listPendingImports();
	}),

	process: os
		.input(
			z.object({
				jobIds: z.array(z.string().uuid()),
				targetSourceId: z.string().uuid(),
			}),
		)
		.handler(async ({ input }) => {
			return await importRequestService.processPendingImports(
				input.jobIds,
				input.targetSourceId,
			);
		}),

	cancel: os
		.input(
			z.object({
				jobIds: z.array(z.string().uuid()),
			}),
		)
		.handler(async ({ input }) => {
			return await importRequestService.cancelPendingImports(input.jobIds);
		}),

	events: os.handler(async function* ({ signal }) {
		yield { event: "connected", data: "connected" };

		const queue: Array<{ event: string; data: unknown }> = [];
		let resolve: (() => void) | null = null;

		const onEvent = (payload: {
			event: ImportRequestEventName;
			data: unknown;
		}) => {
			queue.push(payload);
			if (resolve) {
				resolve();
				resolve = null;
			}
		};

		SseManager.emitter.on("event:global-imports", onEvent);

		try {
			while (!signal?.aborted) {
				if (queue.length === 0) {
					await new Promise<void>((resume) => {
						const onAbort = () => {
							resume();
						};
						if (signal) {
							signal.addEventListener("abort", onAbort, { once: true });
						}
						resolve = () => {
							if (signal) {
								signal.removeEventListener("abort", onAbort);
							}
							resume();
						};
					});
				}

				while (queue.length > 0) {
					const item = queue.shift();
					if (item) {
						yield item;
					}
				}
			}
		} finally {
			SseManager.emitter.off("event:global-imports", onEvent);
		}
	}),
};
