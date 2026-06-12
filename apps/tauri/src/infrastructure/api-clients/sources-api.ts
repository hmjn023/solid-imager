export {
	createMediaSource,
	deleteMediaSource,
	fetchMediaSource,
	fetchMediaSources,
	syncMediaSources,
	updateMediaSource,
} from "~/api/sources-api";

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { client } from "~/orpc-client";

const isDev = import.meta.env.DEV;
const API_BASE = isDev
	? window.location.origin
	: import.meta.env.VITE_API_URL || "http://192.168.1.150:3000";

const apiFetch = isDev ? fetch : tauriFetch;

export async function fetchSourceDump(
	id: string,
	mode: "json" | "zip" | "lancedb" = "json",
	opts?: { includeImages?: boolean },
): Promise<Blob> {
	const includeImages = opts?.includeImages ?? false;
	const url = `${API_BASE}/api/sources/${id}/dump?mode=${mode}&includeImages=${includeImages}`;
	const response = await apiFetch(url, { method: "GET" });
	if (!response.ok) {
		throw new Error(`Failed to download dump: ${response.status}`);
	}
	return response.blob();
}

export async function restoreSource(
	sourceId: string,
	data: unknown,
	_opts?: {
		signal?: AbortSignal;
		onProgress?: (done: number, total: number) => void;
	},
) {
	return client.sources.restore({
		id: sourceId,
		data: data as unknown[],
	});
}

export async function importSourceZip(id: string, file: File) {
	const url = `${API_BASE}/api/sources/${id}/import`;
	const response = await apiFetch(url, {
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
