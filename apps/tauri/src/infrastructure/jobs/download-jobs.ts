import type { JobRecord } from "@solid-imager/application/ports/job-repository";
import {
	type DownloadArtifact,
	queueDownloadJobs as queueSharedDownloadJobs,
	runDownloadImageJob,
} from "@solid-imager/application/services/download-job-runner";
import type { MediaPathAdapter } from "@solid-imager/application/services/media-service";
import { resolveUploadTargetPath } from "@solid-imager/application/services/media-upload-utils";
import type { DownloadItem } from "@solid-imager/core/domain/media/schemas";
import { getMediaTypeFromExtension } from "@solid-imager/core/domain/media/utils/media-type-utils";
import {
	basenameFromUrl,
	guessExtensionFromUrl,
} from "@solid-imager/core/utils/download-utils";
import { emit } from "@tauri-apps/api/event";
import { getTauriAppServices } from "~/app-services";
import { TauriMediaRepository } from "~/infrastructure/local-api/repositories/media-repository";
import { TauriJobRepository } from "~/infrastructure/local-api/repositories/tauri-job-repository";
import { fetchMediaSource } from "../api-clients/sources-api";
import {
	basename,
	dirname,
	extname,
	joinLocalPath,
	toRelativePath,
} from "../path-utils";

function resolveDownloadTarget(item: DownloadItem) {
	if (item.targetUrl) {
		return item.targetUrl;
	}
	return item.sourceUrls?.[0];
}

function inferMediaTypeFromPath(filePath: string): "image" | "video" | "audio" {
	const mediaType = getMediaTypeFromExtension(filePath);
	if (mediaType === "video" || mediaType === "audio") {
		return mediaType;
	}
	return "image";
}

const pathAdapter: MediaPathAdapter = {
	join: joinLocalPath,
	extname,
	basename,
	relative: toRelativePath,
};

export async function enqueueDownloadJobs(
	targetSourceId: string,
	items: DownloadItem[],
): Promise<number> {
	return await queueSharedDownloadJobs(
		TauriJobRepository,
		targetSourceId,
		items,
	);
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
			const resolved = await resolveUploadTargetPath(
				context.basePath,
				sourceFileName,
				false,
				true,
				{
					pathAdapter,
					exists: async (p) => await getTauriAppServices().fileSystem.exists(p),
				},
			);
			const targetPath = resolved.fullPath;
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
			if (createdAt && Number.isNaN(createdAt.getTime())) {
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
				const existing = await TauriMediaRepository.findByPath(
					context.mediaSourceId,
					normalizedPath,
				);
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
					console.error(
						"[registerMedia] batchUpsert returned empty result for",
						artifact.filePath,
					);
					return;
				}
				const eventPayload = {
					mediaSourceId: context.mediaSourceId,
					mediaId: row.id,
					filePath: normalizedPath,
					timestamp: new Date().toISOString(),
				};
				if (existing) {
					await emit("media-changed", eventPayload);
				} else {
					await emit("media-added", eventPayload);
				}
			} catch (error) {
				console.error(
					"[registerMedia] Failed to upsert media for",
					artifact.filePath,
					error,
				);
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
