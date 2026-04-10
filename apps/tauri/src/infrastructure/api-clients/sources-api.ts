import type { MediaSourceInfo } from "@solid-imager/core/domain/sources/schemas";
import { getTauriAppServices } from "~/app-services";
import { joinLocalPath } from "../path-utils";
import { orpc } from "./orpc-client";

export function fetchMediaSources() {
	return orpc.sources.list();
}

export function fetchMediaSource(id: string) {
	return orpc.sources.get({ id });
}

export function createMediaSource(data: MediaSourceInfo) {
	return orpc.sources.create(data);
}

export function updateMediaSource(id: string, data: Partial<MediaSourceInfo>) {
	return orpc.sources.update({ id, data });
}

export async function deleteMediaSource(id: string): Promise<void> {
	await orpc.sources.delete({ id });
}

export function syncMediaSources(ids: string[]) {
	return orpc.sources.sync({ ids });
}

export async function fetchSourceDump(
	id: string,
	mode: "json" | "zip" = "json",
): Promise<Blob> {
	if (mode === "zip") {
		throw new Error("ZIP dump is not supported in Tauri yet.");
	}
	const source = await fetchMediaSource(id);
	const result = await orpc.media.search({
		sourceId: id,
		params: {
			limit: 10_000,
			offset: 0,
			order: "desc",
		},
	});
	const data = {
		source,
		media: result.media,
		exportedAt: new Date().toISOString(),
	};
	return new Blob([JSON.stringify(data, null, 2)], {
		type: "application/json",
	});
}

export async function restoreSource(id: string, data: unknown) {
	const source = await fetchMediaSource(id);
	if (source.type !== "local") {
		throw new Error("Only local sources are supported in Tauri.");
	}
	const rootPath = (source.connectionInfo as { path?: string }).path;
	if (!rootPath) {
		throw new Error("Source path is missing.");
	}
	const payload = data as {
		media?: Array<{ filePath?: string; fileName?: string }>;
	};
	const items = payload.media || [];
	for (const item of items) {
		const targetName = item.fileName || item.filePath;
		if (!targetName) {
			continue;
		}
		const targetPath = joinLocalPath(rootPath, targetName);
		if (!(await getTauriAppServices().fileSystem.exists(targetPath))) {
		}
	}
	const result = await syncMediaSources([id]);
	return {
		processed: items.length,
		skipped: 0,
		result,
	};
}

export async function importSourceZip() {
	throw new Error("ZIP restore is not supported in Tauri yet.");
}
