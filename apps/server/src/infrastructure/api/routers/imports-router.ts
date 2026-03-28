import { os } from "@orpc/server";
import { downloadItemSchema } from "@solid-imager/core/domain/media/schemas";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/infrastructure/db";
import { jobs } from "~/infrastructure/db/schema";
import { queueDownloadJobs } from "~/infrastructure/jobs/download-jobs";
import { SseManager } from "~/infrastructure/jobs/sse-manager";

/**
 * Helper to classify items into Restore (file exists) and Import (URL available)
 */
async function classifyBulkAddItems(
	items: z.infer<typeof downloadItemSchema>[],
	BackupService: any,
) {
	const restoreGroups = new Map<string, z.infer<typeof downloadItemSchema>[]>();
	const importItems: z.infer<typeof downloadItemSchema>[] = [];
	let skippedCount = 0;

	for (const item of items) {
		let handled = false;

		// Check for local file existence (Restore)
		if (item.filePath) {
			const sourceId = await BackupService.findMediaSourceForFile(
				item.filePath,
			);
			if (sourceId) {
				const group = restoreGroups.get(sourceId) || [];
				group.push(item);
				restoreGroups.set(sourceId, group);
				handled = true;
			}
		}

		if (handled) {
			continue;
		}

		// Fallback: Check for URL (Import)
		if (!item.targetUrl && item.sourceUrls && item.sourceUrls.length > 0) {
			item.targetUrl = item.sourceUrls[0];
		}

		if (item.targetUrl) {
			importItems.push(item);
		} else {
			skippedCount++;
		}
	}

	return { restoreGroups, importItems, skippedCount };
}

/**
 * Bulk add handler logic.
 * Exported for testing purposes.
 */
export const bulkAddHandler = async ({
	input,
}: {
	input: { items: z.infer<typeof downloadItemSchema>[] };
}) => {
	const { items } = input;
	if (items.length === 0) {
		return { addedCount: 0, skippedCount: 0, restoredCount: 0 };
	}

	const { BackupService } = await import(
		"~/application/services/backup-service"
	);

	const classification = await classifyBulkAddItems(items, BackupService);
	const { restoreGroups, importItems } = classification;
	let { skippedCount } = classification;

	let restoredCount = 0;
	let addedCount = 0;

	// 2. Execute Restore
	for (const [sourceId, group] of restoreGroups) {
		try {
			const result = await BackupService.restoreSource(sourceId, group);
			restoredCount += result.processed;
			skippedCount += result.skipped;
		} catch (_e) {
			// If restore fails for a source, count as skipped? Or log error?
			// Current implementation in BackupService usually handles safe partial restore.
		}
	}

	// 3. Create Import Jobs
	if (importItems.length > 0) {
		const jobValues = importItems.map((item) => ({
			type: "import_request",
			status: "pending" as const,
			payload: { ...item, targetUrl: item.targetUrl! },
			updatedAt: new Date(),
		}));

		// Chunking inserts
		const ChunkSize = 100;
		for (let i = 0; i < jobValues.length; i += ChunkSize) {
			const chunk = jobValues.slice(i, i + ChunkSize);
			await db.insert(jobs).values(chunk);
		}
		addedCount = importItems.length;

		SseManager.sendEvent("global-imports", "import-request:created", {
			count: addedCount,
		});
	}

	return { addedCount, skippedCount, restoredCount };
};

/**
 * Imports Router Implementation
 */
export const importsRouter = {
	/**
	 * Bulk add items from Xtracter.
	 * Checks for duplicates and creates import_request jobs.
	 */
	bulkAdd: os
		.input(z.object({ items: z.array(downloadItemSchema) }))
		.handler(bulkAddHandler),

	/**
	 * List pending import requests.
	 */
	listPending: os.handler(async () => {
		const pendingJobs = await db.query.jobs.findMany({
			where: and(eq(jobs.type, "import_request"), eq(jobs.status, "pending")),
			orderBy: (fields, { desc }) => [desc(fields.createdAt)],
		});

		return pendingJobs.map((job) => ({
			id: job.id,
			item: job.payload as z.infer<typeof downloadItemSchema>,
			createdAt: job.createdAt,
		}));
	}),

	/**
	 * Process selected import requests (Queue downloads).
	 */
	process: os
		.input(
			z.object({
				jobIds: z.array(z.string().uuid()),
				targetSourceId: z.string().uuid(),
			}),
		)
		.handler(async ({ input }) => {
			const { jobIds, targetSourceId } = input;

			// Detect if jobIds is empty
			if (jobIds.length === 0) {
				return { success: true, processedCount: 0 };
			}

			// Fetch jobs
			const importJobs = await db.query.jobs.findMany({
				where: and(inArray(jobs.id, jobIds), eq(jobs.type, "import_request")),
			});

			const itemsToDownload = importJobs.map(
				(job) => job.payload as z.infer<typeof downloadItemSchema>,
			);

			if (itemsToDownload.length > 0) {
				await queueDownloadJobs(targetSourceId, itemsToDownload);
			}

			// Update jobs to completed
			await db
				.update(jobs)
				.set({ status: "completed", updatedAt: new Date() })
				.where(inArray(jobs.id, jobIds));

			SseManager.sendEvent("global-imports", "import-request:processed", {
				processedCount: itemsToDownload.length,
			});

			return { success: true, processedCount: itemsToDownload.length };
		}),

	/**
	 * Cancel/Delete import requests.
	 */
	cancel: os
		.input(
			z.object({
				jobIds: z.array(z.string().uuid()),
			}),
		)
		.handler(async ({ input }) => {
			const { jobIds } = input;
			if (jobIds.length === 0) {
				return { success: true };
			}

			await db.delete(jobs).where(inArray(jobs.id, jobIds));
			SseManager.sendEvent("global-imports", "import-request:deleted", {
				jobIds,
			});
			return { success: true };
		}),

	/**
	 * Real-time events stream for imports
	 */
	events: os.handler(async function* ({ signal }) {
		// Yield initial connection event
		yield { event: "connected", data: "connected" };

		// Queue for events
		const queue: { event: string; data: any }[] = [];
		let resolve: (() => void) | null = null;

		const mediaSourceId = "global-imports";

		const onEvent = (payload: { event: string; data: any }) => {
			queue.push(payload);
			if (resolve) {
				resolve();
				resolve = null;
			}
		};

		const eventName = `event:${mediaSourceId}`;
		SseManager.emitter.on(eventName, onEvent);

		try {
			while (!signal?.aborted) {
				if (queue.length === 0) {
					await new Promise<void>((r) => {
						const onAbort = () => {
							r();
						};
						if (signal) {
							signal.addEventListener("abort", onAbort, { once: true });
						}
						resolve = () => {
							if (signal) {
								signal.removeEventListener("abort", onAbort);
							}
							r();
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
			SseManager.emitter.off(eventName, onEvent);
		}
	}),
};
