import { readConnectionSettings } from "./connection-settings";
import { APIError, createClient } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/contract";

export { APIError };

export { DEFAULT_API_URL } from "./connection-settings";
const REQUEST_TIMEOUT_MS = 10_000; // 10秒

/** Creates an API client using the saved URL or localhost, with a ten-second fetch timeout. */
export const getClient = async (apiUrl?: string) => {
	const url = apiUrl ?? (await readConnectionSettings()).apiUrl;
	return createApiClient(url);
};

/** Bind a client to an immutable connection URL for the whole operation and its retries. */
export const createApiClient = (url: string) => {
	return createClient<AppContract>({
		url,
		fetch: async (input, init) => {
			try {
				const response = await fetch(input, {
					...init,
					signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				});
				return response;
			} catch (error) {
				throw handleFetchError(error, url);
			}
		},
	});
};

function handleFetchError(error: unknown, url: string): APIError {
	if (error instanceof Error) {
		if (error.name === "AbortError" || error.name === "TimeoutError") {
			return new APIError(
				`Request timeout after ${REQUEST_TIMEOUT_MS}ms`,
				"TIMEOUT",
				error,
			);
		}
		if (
			error.message.includes("CORS") ||
			error.message.includes("cross-origin")
		) {
			return new APIError(
				"CORS error - server may not allow requests from this origin",
				"CORS_ERROR",
				error,
			);
		}
		if (
			error.message.includes("Failed to fetch") ||
			error.message.includes("NetworkError")
		) {
			return new APIError(
				`Network error - cannot connect to ${url}`,
				"NETWORK_ERROR",
				error,
			);
		}
	}

	return new APIError("Unknown error during API request", "UNKNOWN", error);
}

/**
 * APIサーバーへの接続をテストする
 */
export const testConnection = async (
	apiUrl?: string,
): Promise<{ success: boolean; error?: string }> => {
	try {
		const client = await getClient(apiUrl);
		await client.sources.list();

		return { success: true };
	} catch (error) {
		if (error instanceof APIError) {
			return { success: false, error: error.message };
		}

		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
};
