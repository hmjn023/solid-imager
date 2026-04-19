import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "@solid-imager/server/domain/shared/api-contract";

const DEFAULT_API_URL = "http://localhost:3000/api/rpc";
const REQUEST_TIMEOUT_MS = 10_000; // 10秒

export class APIError extends Error {
	readonly code: "NETWORK_ERROR" | "TIMEOUT" | "CORS_ERROR" | "SERVER_ERROR" | "UNKNOWN";
	readonly originalError?: unknown;

	constructor(
		message: string,
		code: "NETWORK_ERROR" | "TIMEOUT" | "CORS_ERROR" | "SERVER_ERROR" | "UNKNOWN",
		originalError?: unknown,
	) {
		super(message);
		this.name = "APIError";
		this.code = code;
		this.originalError = originalError;
	}
}

export const getClient = async () => {
	const result = await chrome.storage.local.get(["apiUrl"]);
	const url = result.apiUrl || DEFAULT_API_URL;

	const link = new RPCLink({
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

	return createORPCClient(link) as RouterClient<AppRouter>;
};

function handleFetchError(error: unknown, url: string): APIError {
	if (error instanceof Error) {
		if (error.name === "AbortError") {
			return new APIError(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`, "TIMEOUT", error);
		}
		if (error.message.includes("CORS") || error.message.includes("cross-origin")) {
			return new APIError(
				"CORS error - server may not allow requests from this origin",
				"CORS_ERROR",
				error,
			);
		}
		if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
			return new APIError(`Network error - cannot connect to ${url}`, "NETWORK_ERROR", error);
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
