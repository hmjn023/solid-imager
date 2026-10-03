import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { getApiBaseUrl, isDevelopmentProxy } from "./api-base";

export function buildAbsoluteUrl(path: string): string {
	const baseUrl = new URL(getApiBaseUrl());
	const basePath = baseUrl.pathname.replace(/\/+$/, "");
	return `${baseUrl.origin}${basePath}${path.startsWith("/") ? path : `/${path}`}`;
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
	return isDevelopmentProxy() ? fetch : tauriFetch;
}
