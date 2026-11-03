import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { getApiBaseUrl, isDevelopmentProxy } from "./api-base";

/** Resolves an API path against the configured base, retaining any base pathname. */
export function buildAbsoluteUrl(path: string): string {
	const baseUrl = new URL(getApiBaseUrl());
	const basePath = baseUrl.pathname.replace(/\/+$/, "");
	return `${baseUrl.origin}${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Fetches a resource as an object URL; the caller must revoke it when no longer needed.
 *
 * @param path - API path relative to the configured server base path.
 * @param mimeType - Optional override for the fetched blob’s MIME type.
 * @returns An object URL owned by the caller.
 * @throws If the request fails or returns a non-success status.
 */
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

/** Uses browser fetch for the development proxy and Tauri HTTP for remote servers. */
export function getApiFetch() {
	return isDevelopmentProxy() ? fetch : tauriFetch;
}
