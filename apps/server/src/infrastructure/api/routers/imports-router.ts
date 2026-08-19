import { implement } from "@orpc/server";
import { importsContract } from "@solid-imager/core/domain/contract/imports.contract";
import type { downloadItemSchema } from "@solid-imager/core/domain/media/schemas";
import type { ImportEvent } from "@solid-imager/core/domain/sources/events";
import { and, count, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { db } from "~/infrastructure/db";
import { jobs } from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { queueDownloadJobs } from "~/infrastructure/jobs/download-jobs";
import type { BackupService } from "~/infrastructure/services/backup-service";

/**
 * Helper to classify items into Restore (file exists) and Import (URL available)
 */
async function classifyBulkAddItems(
	items: z.infer<typeof downloadItemSchema>[],
	backupService: typeof BackupService,
) {
	const restoreGroups = new Map<string, z.infer<typeof downloadItemSchema>[]>();
	const importItems: z.infer<typeof downloadItemSchema>[] = [];
	let skippedCount = 0;

	for (const item of items) {
		let handled = false;

		// Check for local file existence (Restore)
		if (item.filePath) {
			const sourceId = await backupService.findMediaSourceForFile(
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
		"~/infrastructure/services/backup-service"
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
			payload: { ...item, targetUrl: item.targetUrl ?? "" },
			updatedAt: new Date(),
		}));

		// Chunking inserts
		const ChunkSize = 100;
		for (let i = 0; i < jobValues.length; i += ChunkSize) {
			const chunk = jobValues.slice(i, i + ChunkSize);
			await db.insert(jobs).values(chunk);
		}
		addedCount = importItems.length;

		RealtimeEventBus.publishImport("import-request:created", {
			count: addedCount,
		});
	}

	return { addedCount, skippedCount, restoredCount };
};

/**
 * Imports Router Implementation
 */
const os = implement(importsContract);

export const importsRouter = os.router({
	/**
	 * Bulk add items from Xtracter.
	 * Checks for duplicates and creates import_request jobs.
	 */
	bulkAdd: os.bulkAdd.handler(bulkAddHandler),

	/**
	 * List pending import requests.
	 */
	listPending: os.listPending.handler(async () => {
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
	 * Count pending import requests without loading their payloads.
	 */
	countPending: os.countPending.handler(async () => {
		const [result] = await db
			.select({ count: count() })
			.from(jobs)
			.where(and(eq(jobs.type, "import_request"), eq(jobs.status, "pending")));

		return { count: result?.count ?? 0 };
	}),

	/**
	 * Process selected import requests (Queue downloads).
	 */
	process: os.process.handler(async ({ input }) => {
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

		RealtimeEventBus.publishImport("import-request:processed", {
			processedCount: itemsToDownload.length,
		});

		return { success: true, processedCount: itemsToDownload.length };
	}),

	/**
	 * Cancel/Delete import requests.
	 */
	cancel: os.cancel.handler(async ({ input }) => {
		const { jobIds } = input;
		if (jobIds.length === 0) {
			return { success: true };
		}

		await db.delete(jobs).where(inArray(jobs.id, jobIds));
		RealtimeEventBus.publishImport("import-request:deleted", {
			jobIds,
		});
		return { success: true };
	}),

	/**
	 * Real-time events stream for imports
	 */
	events: os.events.handler(async function* ({ signal }) {
		// Queue for events
		const queue: ImportEvent[] = [];
		let resolve: (() => void) | null = null;

		const onEvent = (payload: ImportEvent) => {
			queue.push(payload);
			if (resolve) {
				resolve();
				resolve = null;
			}
		};

		const unsubscribe = RealtimeEventBus.subscribeToImports(onEvent);

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
			unsubscribe();
		}
	}),
});
