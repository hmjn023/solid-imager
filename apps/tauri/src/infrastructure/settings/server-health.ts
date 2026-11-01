import { createClient } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/domain/contract";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

const HEALTH_CHECK_TIMEOUT_MS = 5_000;

export type ServerHealthResult = {
	endpoint: string;
	latencyMs: number;
};

function buildHealthEndpoint(baseUrl: string): string {
	const parsed = new URL(baseUrl.trim());
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error("Server URL must use http or https.");
	}
	if (parsed.username || parsed.password) {
		throw new Error("Credentials must not be embedded in the server URL.");
	}
	const basePath = parsed.pathname
		.replace(/\/+$/, "")
		.replace(/\/api\/rpc$/, "");
	// Probe an existing oRPC procedure instead of relying on a separate health
	// route that may not exist on an older deployed server.
	parsed.pathname = `${basePath}/api/rpc/config/get`;
	parsed.search = "";
	parsed.hash = "";
	return parsed.toString();
}

function canUseBrowserFetch(baseUrl: string): boolean {
	if (!import.meta.env.DEV || typeof window === "undefined") {
		return false;
	}
	return new URL(baseUrl).origin === window.location.origin;
}

export async function checkServerHealth(
	baseUrl: string,
): Promise<ServerHealthResult> {
	const endpoint = buildHealthEndpoint(baseUrl);
	const startedAt = performance.now();
	const client = createClient<AppContract>({
		url: baseUrl,
		fetch: canUseBrowserFetch(baseUrl) ? fetch : tauriFetch,
		timeoutMs: HEALTH_CHECK_TIMEOUT_MS,
	});
	const config = await client.config.get();
	if (typeof config?.version !== "string")
		throw new Error("The server returned an invalid API response.");
	return { endpoint, latencyMs: Math.round(performance.now() - startedAt) };
}
