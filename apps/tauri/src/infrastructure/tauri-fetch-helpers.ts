import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { API_BASE } from "./api-base";

const isDev = import.meta.env.DEV;

export function buildAbsoluteUrl(path: string): string {
	return `${API_BASE}${path}`;
}

export async function fetchAsBlobUrl(
	path: string,
	mimeType?: string,
): Promise<string> {
	const url = buildAbsoluteUrl(path);
	const response = await getApiFetch()(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status}`);
	}
	const blob = await response.blob();
	const typedBlob = mimeType ? new Blob([blob], { type: mimeType }) : blob;
	return URL.createObjectURL(typedBlob);
}

export function getApiFetch() {
	return isDev ? fetch : tauriFetch;
}
