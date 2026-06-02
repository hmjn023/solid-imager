import { APIError, createClient } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/domain/contract";

export { APIError };

const DEFAULT_API_URL = "http://localhost:3000/api/rpc";
const REQUEST_TIMEOUT_MS = 10_000; // 10秒

export const getClient = async () => {
	const result = await chrome.storage.local.get(["apiUrl"]);
	const url = result.apiUrl || DEFAULT_API_URL;

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
		if (error.name === "AbortError") {
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
		if (apiUrl) {
			await chrome.storage.local.set({ apiUrl });
		}

		const client = await getClient();
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
