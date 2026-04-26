import {
	createImportRequestService,
	type PendingImportJob,
} from "@solid-imager/application/services/import-request-service";
import type { JobRecord } from "@solid-imager/application/ports/job-repository";
import type { DownloadItem } from "@solid-imager/core/domain/media/schemas";
import { emit } from "@tauri-apps/api/event";
import { getTauriAppServices } from "~/app-services";
import { TauriJobRepository } from "~/infrastructure/local-api/repositories/tauri-job-repository";
import { TauriSourceBackupService } from "~/infrastructure/local-api/services/source-backup-service";
import { TauriSourceService } from "~/infrastructure/local-api/services/source-service";
import {
	dirname,
	extname,
	joinLocalPath,
	splitStemAndExt,
} from "../path-utils";
import { fetchMediaSource, syncMediaSources } from "./sources-api";

async function emitImportEvent(
	event: string,
	payload: Record<string, unknown>,
) {
	await emit(event, payload);
}

function resolveDownloadTarget(item: DownloadItem) {
	if (item.targetUrl) {
		return item.targetUrl;
	}
	return item.sourceUrls?.[0];
}

async function downloadItemToSource(
	targetSourceId: string,
	item: DownloadItem,
) {
	const downloadTarget = resolveDownloadTarget(item);
	if (!downloadTarget) {
		throw new Error("targetUrl or sourceUrls[0] is required");
	}

	const source = await fetchMediaSource(targetSourceId);
	if (source.type !== "local") {
		throw new Error("Only local sources are supported in Tauri.");
	}

	const response = await fetch(downloadTarget);
	if (!response.ok) {
		throw new Error(`Failed to download ${downloadTarget}: ${response.status}`);
	}

	const bytes = new Uint8Array(await response.arrayBuffer());
	const targetRoot = (source.connectionInfo as { path?: string }).path;
	if (!targetRoot) {
		throw new Error("Source path is missing.");
	}

	const sourceFileName =
		item.fileName ||
		basenameFromUrl(downloadTarget) ||
		`${crypto.randomUUID()}${guessExtension(response)}`;
	const targetPath = await resolveUniqueTargetPath(targetRoot, sourceFileName);
	await getTauriAppServices().fileSystem.mkdir(dirname(targetPath), {
		recursive: true,
	});
	await getTauriAppServices().fileSystem.writeFile(targetPath, bytes);
}

function basenameFromUrl(url: string) {
	try {
		const parsed = new URL(url);
		const fileName = parsed.pathname.split("/").pop();
		return fileName || undefined;
	} catch {
		return undefined;
	}
}

function guessExtension(response: Response) {
	const contentType = response.headers.get("content-type") || "";
	if (contentType.includes("png")) return ".png";
	if (contentType.includes("jpeg")) return ".jpg";
	if (contentType.includes("webp")) return ".webp";
	if (contentType.includes("gif")) return ".gif";
	return extname(new URL(response.url).pathname) || "";
}

async function resolveUniqueTargetPath(rootPath: string, fileName: string) {
	const fs = getTauriAppServices().fileSystem;
	const { stem, extension } = splitStemAndExt(fileName);
	let index = 0;
	while (true) {
		const candidateName =
			index === 0 ? `${stem}${extension}` : `${stem}-${index}${extension}`;
		const candidatePath = joinLocalPath(rootPath, candidateName);
		if (!(await fs.exists(candidatePath))) {
			return candidatePath;
		}
		index += 1;
	}
}

export async function processImportItemsToSource(
	targetSourceId: string,
	items: DownloadItem[],
) {
	for (const item of items) {
		await downloadItemToSource(targetSourceId, item);
	}
	await syncMediaSources([targetSourceId]);
	return { success: true, processedCount: items.length };
}

export async function enqueueDownloadJobs(
	targetSourceId: string,
	items: DownloadItem[],
): Promise<number> {
	for (const item of items) {
		await TauriJobRepository.create({
			type: "downloadImage",
			mediaSourceId: targetSourceId,
			payload: {
				...item,
				imageUrl: item.targetUrl,
				sourceUrl: item.targetUrl,
				createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
			},
		});
	}
	return items.length;
}

export async function processQueuedDownloadJob(job: JobRecord): Promise<void> {
	if (!job.mediaSourceId) {
		throw new Error(`Job ${job.id} missing mediaSourceId`);
	}

	await downloadItemToSource(job.mediaSourceId, job.payload as DownloadItem);
	await TauriSourceService.sync([job.mediaSourceId]);
}

const importRequestService = createImportRequestService({
	jobRepository: TauriJobRepository,
	findMediaSourceForFile: async (filePath) =>
		await TauriSourceBackupService.findMediaSourceForFile(filePath),
	restoreSource: async (sourceId, items) =>
		await TauriSourceBackupService.restoreSource(sourceId, items),
	executeImport: async (targetSourceId, items) =>
		await processImportItemsToSource(targetSourceId, items),
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
