import type { JobRecord } from "@solid-imager/application/ports/job-repository";
import {
	type DownloadArtifact,
	queueDownloadJobs as queueSharedDownloadJobs,
	runDownloadImageJob,
} from "@solid-imager/application/services/download-job-runner";
import {
	createImportRequestService,
	type PendingImportJob,
} from "@solid-imager/application/services/import-request-service";
import type { DownloadItem } from "@solid-imager/core/domain/media/schemas";
import { getMediaTypeFromExtension } from "@solid-imager/core/domain/media/utils/media-type-utils";
import { emit } from "@tauri-apps/api/event";
import { getTauriAppServices } from "~/app-services";
import { TauriMediaRepository } from "~/infrastructure/local-api/repositories/media-repository";
import { TauriJobRepository } from "~/infrastructure/local-api/repositories/tauri-job-repository";
import { TauriSourceBackupService } from "~/infrastructure/local-api/services/source-backup-service";
import { dirname, extname, joinLocalPath, splitStemAndExt, toRelativePath } from "../path-utils";
import { fetchMediaSource, syncMediaSources } from "./sources-api";

async function emitImportEvent(event: string, payload: Record<string, unknown>) {
	await emit(event, payload);
}

function resolveDownloadTarget(item: DownloadItem) {
	if (item.targetUrl) {
		return item.targetUrl;
	}
	return item.sourceUrls?.[0];
}

async function downloadItemToSource(targetSourceId: string, item: DownloadItem) {
	const downloadTarget = resolveDownloadTarget(item);
	if (!downloadTarget) {
		throw new Error("targetUrl or sourceUrls[0] is required");
	}

	const source = await fetchMediaSource(targetSourceId);
	if (source.type !== "local") {
		throw new Error("Only local sources are supported in Tauri.");
	}

	const targetRoot = (source.connectionInfo as { path?: string }).path;
	if (!targetRoot) {
		throw new Error("Source path is missing.");
	}

	const sourceFileName =
		item.fileName ||
		basenameFromUrl(downloadTarget) ||
		`${crypto.randomUUID()}${guessExtensionFromUrl(downloadTarget)}`;
	const targetPath = await resolveUniqueTargetPath(targetRoot, sourceFileName);
	await getTauriAppServices().fileSystem.mkdir(dirname(targetPath), {
		recursive: true,
	});
	await getTauriAppServices().commandClient.invoke("download_file", {
		url: downloadTarget,
		destPath: targetPath,
	});
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

function guessExtensionFromUrl(url: string) {
	try {
		return extname(new URL(url).pathname) || "";
	} catch {
		return "";
	}
}

function inferMediaTypeFromPath(filePath: string): "image" | "video" | "audio" {
	const mediaType = getMediaTypeFromExtension(filePath);
	if (mediaType === "video" || mediaType === "audio") {
		return mediaType;
	}
	return "image";
}

async function resolveUniqueTargetPath(rootPath: string, fileName: string) {
	const fs = getTauriAppServices().fileSystem;
	const { stem, extension } = splitStemAndExt(fileName);
	let index = 0;
	while (true) {
		const candidateName = index === 0 ? `${stem}${extension}` : `${stem}-${index}${extension}`;
		const candidatePath = joinLocalPath(rootPath, candidateName);
		if (!(await fs.exists(candidatePath))) {
			return candidatePath;
		}
		index += 1;
	}
}

export async function processImportItemsToSource(targetSourceId: string, items: DownloadItem[]) {
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
	return await queueSharedDownloadJobs(TauriJobRepository, targetSourceId, items);
}

export async function processQueuedDownloadJob(job: JobRecord): Promise<void> {
	await runDownloadImageJob(job, {
		resolveBasePath: async (mediaSourceId) => {
			const source = await fetchMediaSource(mediaSourceId);
			if (source.type !== "local") {
				throw new Error("Only local sources are supported in Tauri.");
			}
			const rootPath = (source.connectionInfo as { path?: string }).path;
			if (!rootPath) {
				throw new Error("Source path is missing.");
			}
			return rootPath;
		},
		selectMode: () => "direct",
		download: async (item, context) => {
			const downloadTarget = resolveDownloadTarget(item);
			if (!downloadTarget) {
				throw new Error("targetUrl or sourceUrls[0] is required");
			}
			const sourceFileName =
				item.fileName ||
				basenameFromUrl(downloadTarget) ||
				`${crypto.randomUUID()}${guessExtensionFromUrl(downloadTarget)}`;
			const targetPath = await resolveUniqueTargetPath(context.basePath, sourceFileName);
			await getTauriAppServices().fileSystem.mkdir(dirname(targetPath), {
				recursive: true,
			});
			await getTauriAppServices().commandClient.invoke("download_file", {
				url: downloadTarget,
				destPath: targetPath,
			});

			const relativePath = toRelativePath(context.basePath, targetPath);
			const stat = await getTauriAppServices().fileSystem.stat(targetPath);
			const mediaType = inferMediaTypeFromPath(targetPath);

			let createdAt = item.createdAt ? new Date(item.createdAt) : undefined;
			if (createdAt && isNaN(createdAt.getTime())) {
				createdAt = undefined;
			}

			return [
				{
					mediaSourceId: context.mediaSourceId,
					filePath: relativePath,
					fileName: sourceFileName,
					mediaType,
					width: 0,
					height: 0,
					fileSize: stat.size,
					description: item.description ?? null,
					createdAt: createdAt ?? new Date(stat.birthtime),
					modifiedAt: new Date(stat.mtime),
					sourceUrls: Array.from(
						new Set(
							[item.targetUrl, ...(item.sourceUrls ?? [])].filter(
								(value): value is string => typeof value === "string",
							),
						),
					),
				} satisfies DownloadArtifact,
			];
		},
		registerMedia: async (artifact, context) => {
			try {
				const normalizedPath = artifact.filePath.replaceAll("\\", "/");
				const [row] = await TauriMediaRepository.batchUpsert([
					{
						mediaSourceId: context.mediaSourceId,
						filePath: normalizedPath,
						fileName: artifact.fileName,
						mediaType: artifact.mediaType,
						width: artifact.width,
						height: artifact.height,
						fileSize: artifact.fileSize,
						description: artifact.description,
						createdAt: artifact.createdAt,
						modifiedAt: artifact.modifiedAt,
					},
				]);
				if (!row) {
					console.error("[registerMedia] batchUpsert returned empty result for", artifact.filePath);
					return;
				}
				const existing = await TauriMediaRepository.findByPath(
					context.mediaSourceId,
					normalizedPath,
				);
				const eventPayload = {
					mediaSourceId: context.mediaSourceId,
					mediaId: row.id,
					filePath: normalizedPath,
					timestamp: new Date().toISOString(),
				};
				if (existing && existing.id !== row.id) {
					// Should not happen, but handle gracefully
					await emit("media-changed", eventPayload);
				} else {
					await emit("media-added", eventPayload);
				}
			} catch (error) {
				console.error("[registerMedia] Failed to upsert media for", artifact.filePath, error);
			}
		},
		events: {
			downloadError: async (event) => {
				await emit("download-error", event);
			},
		},
		logger: console,
	});
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

export async function bulkAddImportItems(items: DownloadItem[], targetSourceId?: string) {
	return await importRequestService.bulkAddImportItems(items, targetSourceId);
}

export async function listPendingImports(): Promise<PendingImportJob[]> {
	return await importRequestService.listPendingImports();
}

export async function processPendingImports(jobIds: string[], targetSourceId?: string) {
	return await importRequestService.processPendingImports(jobIds, targetSourceId);
}

export async function cancelPendingImports(jobIds: string[]) {
	return await importRequestService.cancelPendingImports(jobIds);
}
