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

const thumbnailReadyListeners = new Map<string, Set<() => void>>();

export function subscribeToThumbnailReady(
	mediaId: string,
	callback: () => void,
): () => void {
	let listeners = thumbnailReadyListeners.get(mediaId);
	if (!listeners) {
		listeners = new Set();
		thumbnailReadyListeners.set(mediaId, listeners);
	}
	listeners.add(callback);
	return () => {
		const current = thumbnailReadyListeners.get(mediaId);
		if (current) {
			current.delete(callback);
			if (current.size === 0) {
				thumbnailReadyListeners.delete(mediaId);
			}
		}
	};
}

export function notifyThumbnailReady(mediaId: string): void {
	const listeners = thumbnailReadyListeners.get(mediaId);
	if (listeners) {
		for (const callback of listeners) {
			callback();
		}
	}
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
