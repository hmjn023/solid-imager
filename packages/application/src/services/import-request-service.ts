import {
	type DownloadItem,
	downloadItemSchema,
} from "@solid-imager/core/domain/media/schemas";
import type {
	JobRecord,
	JobRepositoryPort,
	NewJobRecord,
} from "../ports/job-repository";

export const IMPORT_REQUEST_JOB_TYPE = "import_request";

export const IMPORT_REQUEST_EVENTS = [
	"import-request:created",
	"import-request:processed",
	"import-request:deleted",
] as const;
export type ImportRequestEventName = (typeof IMPORT_REQUEST_EVENTS)[number];

export type PendingImportPayload = DownloadItem & {
	targetSourceId?: string;
};

export type PendingImportJob = {
	id: string;
	item: DownloadItem;
	createdAt: Date;
	targetSourceId?: string;
};

type ImportRequestJobRepository = Pick<
	JobRepositoryPort,
	| "createMany"
	| "findPendingImportRequests"
	| "findImportRequestsByIds"
	| "markImportRequestsCompleted"
	| "deleteImportRequests"
>;

type RestoreResult = {
	processed: number;
	skipped: number;
};

type ImportExecutionResult = {
	processedCount: number;
};

export type ImportRequestServiceDeps = {
	jobRepository: ImportRequestJobRepository;
	findMediaSourceForFile(filePath: string): Promise<string | null>;
	restoreSource(
		sourceId: string,
		items: DownloadItem[],
	): Promise<RestoreResult>;
	executeImport(
		targetSourceId: string,
		items: DownloadItem[],
	): Promise<ImportExecutionResult>;
	publishImportEvent(
		event: ImportRequestEventName,
		payload: Record<string, unknown>,
	): Promise<void> | void;
};

type ClassifiedBulkItems = {
	restoreGroups: Map<string, DownloadItem[]>;
	importItems: PendingImportPayload[];
	skippedCount: number;
};

function normalizeImportItem(
	item: DownloadItem,
	targetSourceId?: string,
): PendingImportPayload | null {
	const targetUrl = item.targetUrl ?? item.sourceUrls?.[0];
	if (!targetUrl) {
		return null;
	}

	return {
		...item,
		targetUrl,
		...(targetSourceId ? { targetSourceId } : {}),
	};
}

function mapPendingJob(job: JobRecord): PendingImportJob | null {
	const parsed = downloadItemSchema.safeParse(job.payload);
	if (!parsed.success) {
		return null;
	}

	const targetSourceId = readTargetSourceId(job.payload);
	return {
		id: job.id,
		item: parsed.data,
		createdAt: job.createdAt,
		targetSourceId,
	};
}

function readTargetSourceId(payload: unknown): string | undefined {
	if (
		typeof payload !== "object" ||
		payload === null ||
		!("targetSourceId" in payload)
	) {
		return undefined;
	}

	const { targetSourceId } = payload;
	return typeof targetSourceId === "string" ? targetSourceId : undefined;
}

async function classifyBulkAddItems(
	items: DownloadItem[],
	deps: Pick<ImportRequestServiceDeps, "findMediaSourceForFile">,
	targetSourceId?: string,
): Promise<ClassifiedBulkItems> {
	const restoreGroups = new Map<string, DownloadItem[]>();
	const importItems: PendingImportPayload[] = [];
	let skippedCount = 0;

	for (const item of items) {
		if (item.filePath) {
			const sourceId = await deps.findMediaSourceForFile(item.filePath);
			if (sourceId) {
				const existing = restoreGroups.get(sourceId) ?? [];
				existing.push(item);
				restoreGroups.set(sourceId, existing);
				continue;
			}
		}

		const normalized = normalizeImportItem(item, targetSourceId);
		if (normalized) {
			importItems.push(normalized);
			continue;
		}

		skippedCount += 1;
	}

	return { restoreGroups, importItems, skippedCount };
}

function toImportRequestJob(item: PendingImportPayload): NewJobRecord {
	return {
		type: IMPORT_REQUEST_JOB_TYPE,
		status: "pending",
		payload: item,
		updatedAt: new Date(),
	};
}

export function createImportRequestService(deps: ImportRequestServiceDeps) {
	return {
		async bulkAddImportItems(
			items: DownloadItem[],
			targetSourceId?: string,
		): Promise<{
			addedCount: number;
			skippedCount: number;
			restoredCount: number;
		}> {
			if (items.length === 0) {
				return { addedCount: 0, skippedCount: 0, restoredCount: 0 };
			}

			const classification = await classifyBulkAddItems(
				items,
				deps,
				targetSourceId,
			);
			const { restoreGroups, importItems } = classification;
			let { skippedCount } = classification;
			let restoredCount = 0;

			for (const [sourceId, group] of restoreGroups) {
				try {
					const result = await deps.restoreSource(sourceId, group);
					restoredCount += result.processed;
					skippedCount += result.skipped;
				} catch {
					skippedCount += group.length;
				}
			}

			if (importItems.length > 0) {
				await deps.jobRepository.createMany(
					importItems.map(toImportRequestJob),
				);
				await deps.publishImportEvent("import-request:created", {
					count: importItems.length,
				});
			}

			return {
				addedCount: importItems.length,
				skippedCount,
				restoredCount,
			};
		},

		async listPendingImports(): Promise<PendingImportJob[]> {
			const jobs = await deps.jobRepository.findPendingImportRequests();
			return jobs.flatMap((job) => {
				const pendingJob = mapPendingJob(job);
				return pendingJob ? [pendingJob] : [];
			});
		},

		async processPendingImports(
			jobIds: string[],
			targetSourceId?: string,
		): Promise<{ success: boolean; processedCount: number }> {
			if (jobIds.length === 0) {
				return { success: true, processedCount: 0 };
			}

			const jobs = await deps.jobRepository.findImportRequestsByIds(jobIds);
			const pendingJobs = jobs.flatMap((job) => {
				const pendingJob = mapPendingJob(job);
				return pendingJob ? [pendingJob] : [];
			});
			const items = pendingJobs.map((job) => job.item);
			const resolvedTargetSourceId =
				targetSourceId ?? pendingJobs[0]?.targetSourceId;

			if (!resolvedTargetSourceId) {
				throw new Error("Target source is required");
			}

			const result =
				items.length > 0
					? await deps.executeImport(resolvedTargetSourceId, items)
					: { processedCount: 0 };

			await deps.jobRepository.markImportRequestsCompleted(
				pendingJobs.map((job) => job.id),
			);
			await deps.publishImportEvent("import-request:processed", {
				processedCount: result.processedCount,
			});

			return { success: true, processedCount: result.processedCount };
		},

		async cancelPendingImports(
			jobIds: string[],
		): Promise<{ success: boolean }> {
			if (jobIds.length === 0) {
				return { success: true };
			}

			await deps.jobRepository.deleteImportRequests(jobIds);
			await deps.publishImportEvent("import-request:deleted", { jobIds });
			return { success: true };
		},
	};
}
