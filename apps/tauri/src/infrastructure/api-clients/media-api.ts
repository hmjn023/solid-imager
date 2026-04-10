import type { DownloadItem } from "@solid-imager/core/domain/media/schemas";
import { getTauriAppServices } from "~/app-services";
import { dirname, joinLocalPath, splitStemAndExt } from "../path-utils";
import { orpc } from "./orpc-client";
import { searchMedia } from "./search-api";
import { fetchMediaSource, syncMediaSources } from "./sources-api";

export async function fetchMediaList(sourceId: string) {
	const result = await orpc.media.search({
		sourceId,
		params: {
			offset: 0,
			limit: 100,
			order: "desc",
		},
	});
	return result.media;
}

export function fetchMediaListInfinite(
	sourceId: string,
	pageParam = 0,
	limit = 50,
) {
	return searchMedia(sourceId, {
		offset: pageParam,
		limit,
		sort: "date",
		order: "desc",
	});
}

export function fetchMediaDetails(sourceId: string, mediaId: string) {
	return orpc.media.getDetails({ sourceId, mediaId });
}

export function updateMedia(
	sourceId: string,
	mediaId: string,
	updates: { description?: string | null; sourceUrls?: string[] },
) {
	return orpc.media.update({
		sourceId,
		mediaId,
		data: updates,
	});
}

type UploadOptions = {
	file: File;
	filename: string;
	description: string;
	sourceUrl?: string;
	overwrite: boolean;
	autoIncrement: boolean;
};

async function getLocalSourcePath(sourceId: string) {
	const source = await fetchMediaSource(sourceId);
	if (source.type !== "local") {
		throw new Error("Only local sources are supported in Tauri.");
	}
	const rootPath = (source.connectionInfo as { path?: string }).path;
	if (!rootPath) {
		throw new Error("Source path is missing.");
	}
	return rootPath;
}

async function resolveUploadTargetPath(
	rootPath: string,
	fileName: string,
	options: { overwrite: boolean; autoIncrement: boolean },
) {
	const fs = getTauriAppServices().fileSystem;
	const initialPath = joinLocalPath(rootPath, fileName);
	if (!(await fs.exists(initialPath)) || options.overwrite) {
		return initialPath;
	}
	if (!options.autoIncrement) {
		throw new Error(`File already exists: ${fileName}`);
	}
	const { stem, extension } = splitStemAndExt(fileName);
	let index = 1;
	while (true) {
		const candidate = joinLocalPath(rootPath, `${stem}-${index}${extension}`);
		if (!(await fs.exists(candidate))) {
			return candidate;
		}
		index += 1;
	}
}

export async function uploadMedia(
	sourceId: string,
	file: File,
	options: UploadOptions,
) {
	const rootPath = await getLocalSourcePath(sourceId);
	const targetPath = await resolveUploadTargetPath(rootPath, options.filename, {
		overwrite: options.overwrite,
		autoIncrement: options.autoIncrement,
	});
	const bytes = new Uint8Array(await file.arrayBuffer());
	await getTauriAppServices().fileSystem.mkdir(dirname(targetPath), {
		recursive: true,
	});
	await getTauriAppServices().fileSystem.writeFile(targetPath, bytes);
	await syncMediaSources([sourceId]);
	return { success: true, filePath: targetPath };
}

export async function deleteMedia(sourceId: string, mediaId: string) {
	const media = await fetchMediaDetails(sourceId, mediaId);
	const rootPath = await getLocalSourcePath(sourceId);
	await getTauriAppServices().fileSystem.unlink(
		joinLocalPath(rootPath, media.filePath),
	);
	await syncMediaSources([sourceId]);
	return { success: true };
}

async function copyOrMoveMedia(
	sourceId: string,
	mediaId: string,
	targetSourceId: string,
	mode: "copy" | "move",
) {
	const media = await fetchMediaDetails(sourceId, mediaId);
	const sourceRoot = await getLocalSourcePath(sourceId);
	const targetRoot = await getLocalSourcePath(targetSourceId);
	const sourcePath = joinLocalPath(sourceRoot, media.filePath);
	const targetPath = await resolveUploadTargetPath(targetRoot, media.fileName, {
		overwrite: false,
		autoIncrement: true,
	});

	if (mode === "copy") {
		await getTauriAppServices().fileSystem.copyFile(sourcePath, targetPath);
	} else {
		await getTauriAppServices().fileSystem.rename(sourcePath, targetPath);
	}

	await syncMediaSources(
		mode === "copy" ? [targetSourceId] : [sourceId, targetSourceId],
	);
	return { success: true };
}

export function copyMedia(
	sourceId: string,
	mediaId: string,
	targetSourceId: string,
) {
	return copyOrMoveMedia(sourceId, mediaId, targetSourceId, "copy");
}

export function moveMedia(
	sourceId: string,
	mediaId: string,
	targetSourceId: string,
) {
	return copyOrMoveMedia(sourceId, mediaId, targetSourceId, "move");
}

export async function syncMediaItems(sourceId: string, _mediaIds: string[]) {
	return syncMediaSources([sourceId]);
}

export async function startDownloadJobs(
	_mediaSourceId: string,
	items: DownloadItem[],
) {
	const { bulkAddImportItems } = await import("./imports-api");
	const result = await bulkAddImportItems(items);
	return {
		success: true,
		jobCount: result.addedCount,
		message: `Queued ${result.addedCount} download jobs`,
	};
}
