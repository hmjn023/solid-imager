import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, isAbsolute, join } from "@tauri-apps/api/path";
import { orpc } from "../api-clients/orpc-client";

let thumbnailBasePathPromise: Promise<string> | null = null;

function appendCacheKey(url: string, cacheKey: number) {
	const separator = url.includes("?") ? "&" : "?";
	return `${url}${separator}t=${cacheKey}`;
}

function joinThumbnailPath(
	basePath: string,
	mediaSourceId: string,
	mediaId: string,
) {
	const separator = basePath.includes("\\") ? "\\" : "/";
	const normalizedBase = basePath.replace(/[\\/]+$/, "");
	return `${normalizedBase}${separator}${mediaSourceId}${separator}${mediaId}.webp`;
}

async function resolveThumbnailBasePath(basePath: string) {
	if (await isAbsolute(basePath)) {
		return basePath;
	}
	return join(await appDataDir(), basePath);
}

async function getThumbnailBasePath() {
	if (!thumbnailBasePathPromise) {
		thumbnailBasePathPromise = orpc.config
			.get()
			.then((config) => resolveThumbnailBasePath(config.storage.thumbnailDir))
			.catch((error) => {
				thumbnailBasePathPromise = null;
				throw error;
			});
	}

	return thumbnailBasePathPromise;
}

export function resetThumbnailRuntimeCache() {
	thumbnailBasePathPromise = null;
}

export async function getThumbnailResource(
	mediaSourceId: string,
	mediaId: string,
	cacheKey: number,
) {
	const thumbnailBasePath = await getThumbnailBasePath();
	const filePath = joinThumbnailPath(thumbnailBasePath, mediaSourceId, mediaId);
	return {
		filePath,
		url: appendCacheKey(convertFileSrc(filePath), cacheKey),
	};
}
