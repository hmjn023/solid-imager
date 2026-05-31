export {
	fetchMediaSources,
	fetchMediaSource,
	createMediaSource,
	updateMediaSource,
	deleteMediaSource,
	syncMediaSources,
} from "~/api/sources-api";

import { client } from "~/orpc-client";

export async function fetchSourceDump(
	id: string,
	mode: "json" | "zip" | "lancedb" = "json",
	_includeImages = false,
): Promise<Blob> {
	const url = `/api/sources/${id}/dump?mode=${mode}`;
	const response = await fetch(url, { method: "GET" });
	if (!response.ok) {
		throw new Error(`Failed to download dump: ${response.status}`);
	}
	return response.blob();
}

export function restoreSource(id: string, data: unknown[]) {
	return client.sources.restore({ id, data });
}

export async function importSourceZip(id: string, file: File) {
	const url = `/api/sources/${id}/import`;
	const response = await fetch(url, {
		method: "POST",
		body: file,
	});
	if (!response.ok) {
		throw new Error(`Failed to import ZIP: ${response.status}`);
	}
	return await response.json();
}

export function parseRestoreFile(file: File): Promise<unknown[]> {
	return file.text().then((text) => JSON.parse(text));
}
