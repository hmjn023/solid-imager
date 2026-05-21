import {
	createImportRequestService,
	type PendingImportJob,
} from "@solid-imager/application/services/import-request-service";
import type { DownloadItem } from "@solid-imager/core/domain/media/schemas";
import { emit } from "@tauri-apps/api/event";
import { TauriJobRepository } from "~/infrastructure/local-api/repositories/tauri-job-repository";
import { TauriSourceBackupService } from "~/infrastructure/local-api/services/source-backup-service";
import { enqueueDownloadJobs } from "../jobs/download-jobs";
import { tauriJobQueue } from "../jobs/tauri-job-queue";

async function emitImportEvent(
	event: string,
	payload: Record<string, unknown>,
) {
	await emit(event, payload);
}

async function executeImport(
	targetSourceId: string,
	items: DownloadItem[],
): Promise<{ processedCount: number }> {
	const processedCount = await enqueueDownloadJobs(targetSourceId, items);
	tauriJobQueue.wake();
	return { processedCount };
}

const importRequestService = createImportRequestService({
	jobRepository: TauriJobRepository,
	findMediaSourceForFile: async (filePath) =>
		await TauriSourceBackupService.findMediaSourceForFile(filePath),
	restoreSource: async (sourceId, items) =>
		await TauriSourceBackupService.restoreSource(sourceId, items),
	executeImport: async (targetSourceId, items) =>
		await executeImport(targetSourceId, items),
	publishImportEvent: emitImportEvent,
});

export async function bulkAddImportItems(
	items: DownloadItem[],
	targetSourceId?: string,
) {
	return await importRequestService.bulkAddImportItems(items, targetSourceId);
}

export async function listPendingImports(): Promise<PendingImportJob[]> {
	return await importRequestService.listPendingImports();
}

export async function processPendingImports(
	jobIds: string[],
	targetSourceId?: string,
) {
	return await importRequestService.processPendingImports(
		jobIds,
		targetSourceId,
	);
}

export async function cancelPendingImports(jobIds: string[]) {
	return await importRequestService.cancelPendingImports(jobIds);
}
