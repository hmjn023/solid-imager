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
	const basePath = parsed.pathname.replace(/\/+$/, "");
	// Probe an existing oRPC procedure instead of relying on a separate health
	// route that may not exist on an older deployed server.
	parsed.pathname = `${basePath}/api/rpc/config/get`;
	parsed.search = "";
	parsed.hash = "";
	return parsed.toString();
}

function isHealthPayload(payload: unknown): boolean {
	if (typeof payload !== "object" || payload === null || !("json" in payload)) {
		return false;
	}
	const json = payload.json;
	return (
		typeof json === "object" &&
		json !== null &&
		"version" in json &&
		typeof json.version === "string"
	);
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
	const controller = new AbortController();
	const timeoutId = globalThis.setTimeout(
		() => controller.abort(),
		HEALTH_CHECK_TIMEOUT_MS,
	);
	const startedAt = performance.now();

	try {
		const response = canUseBrowserFetch(baseUrl)
			? await fetch(endpoint, {
					body: JSON.stringify({ json: null }),
					headers: {
						Accept: "application/json",
						"Content-Type": "application/json",
					},
					method: "POST",
					signal: controller.signal,
				})
			: await tauriFetch(endpoint, {
					body: JSON.stringify({ json: null }),
					headers: {
						Accept: "application/json",
						"Content-Type": "application/json",
					},
					method: "POST",
					signal: controller.signal,
				});

		if (!response.ok) {
			throw new Error(`Server API check failed with HTTP ${response.status}.`);
		}

		const payload: unknown = await response.json();
		if (!isHealthPayload(payload)) {
			throw new Error("The server returned an invalid API response.");
		}

		return {
			endpoint,
			latencyMs: Math.round(performance.now() - startedAt),
		};
	} catch (error: unknown) {
		if (error instanceof DOMException && error.name === "AbortError") {
			throw new Error(
				`Server connection timed out after ${HEALTH_CHECK_TIMEOUT_MS / 1000} seconds.`,
			);
		}
		if (error instanceof Error) {
			throw error;
		}
		throw new Error("Unable to reach the server.");
	} finally {
		globalThis.clearTimeout(timeoutId);
	}
}
