import { implement, ORPCError } from "@orpc/server";
import { importsContract } from "@solid-imager/core/domain/contract/imports.contract";
import type { downloadItemSchema } from "@solid-imager/core/domain/media/schemas";
import type { ImportEvent } from "@solid-imager/core/domain/sources/events";
import { z } from "zod";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { getImportRequestService } from "~/infrastructure/services/import-request-service";
import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import { logger } from "~/infrastructure/logger";
import { sourceRunService } from "~/infrastructure/services/source-run-service";
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

	const { BackupService } =
		await import("~/infrastructure/services/backup-service");

	const classification = await classifyBulkAddItems(items, BackupService);
	const { restoreGroups, importItems } = classification;
	let { skippedCount } = classification;

	let restoredCount = 0;
	let addedCount = 0;

	// 2. Execute Restore
	for (const [sourceId, group] of restoreGroups) {
		try {
			const result = await sourceRunService.restoreItems(sourceId, group);
			restoredCount += result.processed;
			skippedCount += result.skipped;
		} catch (err) {
			logger.error({ err, sourceId }, "Bulk source restore failed");
			skippedCount += group.length;
		}
	}

	// 3. Receive approval requests
	if (importItems.length > 0) {
		addedCount = await getImportRequestService().add(importItems);
		skippedCount += importItems.length - addedCount;
	}

	return { addedCount, skippedCount, restoredCount };
};

/**
 * Imports Router Implementation
 */
const os = implement(importsContract);

async function respond<T>(action: () => Promise<T>): Promise<T> {
	try {
		return await action();
	} catch (error) {
		if (error instanceof ResourceNotFoundError)
			throw new ORPCError("NOT_FOUND", { message: "Import target not found" });
		if (error instanceof ResourceConflictError)
			throw new ORPCError("CONFLICT", { message: error.message });
		if (error instanceof z.ZodError)
			throw new ORPCError("BAD_REQUEST", { message: "Invalid import input" });
		logger.error({ err: error }, "Import request operation failed");
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Unable to access import requests",
		});
	}
}

export const importsRouter = os.router({
	/**
	 * Bulk add items from Xtracter.
	 * Checks for duplicates and receives dedicated import requests.
	 */
	bulkAdd: os.bulkAdd.handler((args) => respond(() => bulkAddHandler(args))),

	/**
	 * List pending import requests.
	 */
	listPending: os.listPending.handler(() =>
		respond(() => getImportRequestService().listPending()),
	),

	/**
	 * Count pending import requests without loading their payloads.
	 */
	countPending: os.countPending.handler(() =>
		respond(async () => ({
			count: await getImportRequestService().countPending(),
		})),
	),

	/**
	 * Process selected import requests (Queue downloads).
	 */
	process: os.process.handler(({ input }) =>
		respond(async () => ({
			success: true,
			processedCount: await getImportRequestService().process(
				input.jobIds,
				input.targetSourceId,
			),
		})),
	),

	/**
	 * Cancel/Delete import requests.
	 */
	cancel: os.cancel.handler(({ input }) =>
		respond(async () => {
			await getImportRequestService().cancel(input.jobIds);
			return { success: true };
		}),
	),

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
