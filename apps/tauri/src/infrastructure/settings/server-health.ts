import { createClient } from "@solid-imager/client";
import { appContract } from "@solid-imager/core/contract";
import {
	API_PREFIX,
	CONFIG_ROUTE,
	resolveServerUrl,
} from "@solid-imager/core/http";
import { t } from "@solid-imager/i18n";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

const HEALTH_CHECK_TIMEOUT_MS = 5_000;

/** Endpoint probed and elapsed time for a successful configuration request. */
export type ServerHealthResult = {
	endpoint: string;
	latencyMs: number;
};

function buildHealthEndpoint(baseUrl: string): string {
	const parsed = new URL(baseUrl.trim());
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error(t("serverSettings.httpUrlRequired"));
	}
	if (parsed.username || parsed.password) {
		throw new Error(t("serverSettings.noEmbeddedCredentials"));
	}
	return resolveServerUrl(parsed.href, API_PREFIX + CONFIG_ROUTE);
}

function canUseBrowserFetch(baseUrl: string): boolean {
	if (!import.meta.env.DEV || typeof window === "undefined") {
		return false;
	}
	return new URL(baseUrl.trim()).origin === window.location.origin;
}

/**
 * Fetches the server configuration with a five-second timeout and validates its version.
 *
 * @param baseUrl - HTTP(S) server URL without embedded credentials.
 * @returns The probed endpoint and elapsed time in milliseconds.
 * @throws If the URL is invalid, the request fails, or the response lacks a version string.
 */
export async function checkServerHealth(
	baseUrl: string,
): Promise<ServerHealthResult> {
	const endpoint = buildHealthEndpoint(baseUrl);
	const startedAt = performance.now();
	const client = createClient(appContract, {
		url: baseUrl,
		fetch: canUseBrowserFetch(baseUrl) ? fetch : tauriFetch,
		timeoutMs: HEALTH_CHECK_TIMEOUT_MS,
	});
	const config = await client.config.get();
	if (typeof config?.version !== "string")
		throw new Error(t("serverSettings.invalidApiResponse"));
	return { endpoint, latencyMs: Math.round(performance.now() - startedAt) };
}
