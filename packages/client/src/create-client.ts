import { createORPCClient } from "@orpc/client";
import type { RouterContract, RouterContractClient } from "@orpc/contract";
import { ResponseValidationLinkPlugin } from "@orpc/contract/plugins";
import { OpenAPILink } from "@orpc/openapi/fetch";
import { APIError } from "./api-error";

const DEFAULT_TIMEOUT_MS = 30_000;

type FetchInit = RequestInit & {
	redirect?: Request["redirect"];
	priority?: "high" | "low" | "auto";
};

/** Configuration for the API client. The URL may be resolved for each request. */
export type ClientOptions = {
	/** Absolute server base URL, including any proxy mount. Defaults to http://localhost:3000. */
	url?: string | (() => string);
	/** Fetch implementation used for API requests; defaults to the global fetch. */
	fetch?: (url: string, init?: FetchInit) => Promise<Response>;
	/** Per-request timeout in milliseconds; defaults to 30,000. */
	timeoutMs?: number;
};

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === "AbortError";
}

function createTimeoutError(timeoutMs: number): APIError {
	return new APIError(`API request timed out after ${timeoutMs}ms`, "TIMEOUT");
}

function createNetworkError(error: unknown): APIError {
	if (error instanceof APIError) {
		return error;
	}
	if (error instanceof TypeError) {
		return new APIError("API network request failed", "NETWORK_ERROR", error);
	}
	return new APIError(
		error instanceof Error ? error.message : "Unknown API request error",
		"UNKNOWN",
		error,
	);
}

/**
 * Wrap fetch with a per-request timeout while preserving caller cancellation.
 *
 * @param fetchImpl - Transport to call with the combined abort signal.
 * @param timeoutMs - Maximum request duration in milliseconds.
 * @returns A fetch wrapper that clears its timer when the request settles.
 * @throws APIError with code TIMEOUT when the timeout fires, or NETWORK_ERROR
 * for a TypeError from the transport. Caller abort errors are passed through.
 */
export function createTimedFetch(
	fetchImpl: (url: string, init?: FetchInit) => Promise<Response>,
	timeoutMs: number,
): (url: string, init?: FetchInit) => Promise<Response> {
	return async (url, init) => {
		const controller = new AbortController();
		const timeout = setTimeout(() => {
			controller.abort(createTimeoutError(timeoutMs));
		}, timeoutMs);

		const upstreamSignal = init?.signal;
		const signal = upstreamSignal
			? AbortSignal.any([upstreamSignal, controller.signal])
			: controller.signal;

		try {
			return await fetchImpl(url, { ...init, signal });
		} catch (error) {
			if (controller.signal.aborted) {
				throw controller.signal.reason;
			}
			if (isAbortError(error) && upstreamSignal?.aborted) {
				throw error;
			}
			throw createNetworkError(error);
		} finally {
			clearTimeout(timeout);
		}
	};
}

function serverBaseUrl(url: string): string {
	const endpoint = new URL(url);
	return endpoint.origin + endpoint.pathname.replace(/\/+$/, "");
}

/**
 * Create a typed HTTP client from a server base URL and its API contract.
 * Requests time out after 30 seconds unless configured otherwise.
 *
 * @param contract - Contract containing the endpoint methods, paths, and schemas.
 * @param options - Server URL, optional transport and request timeout.
 * @throws If a static URL is invalid. A URL callback is evaluated when used.
 */
export function createClient<C extends RouterContract>(
	contract: C,
	options: ClientOptions = {},
): RouterContractClient<C> {
	const url = options.url;
	const origin =
		typeof url === "function"
			? () => serverBaseUrl(url())
			: serverBaseUrl(url || "http://localhost:3000");
	const fetchImpl = createTimedFetch(
		options.fetch ?? ((request, init) => fetch(request, init)),
		options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
	);

	const link = new OpenAPILink(contract, {
		origin,
		url: "/api",
		fetch: fetchImpl,
		// Restore contract types such as dates after decoding the HTTP response.
		plugins: [new ResponseValidationLinkPlugin(contract)],
	});

	return createORPCClient(link);
}
