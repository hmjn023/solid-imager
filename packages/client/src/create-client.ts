import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterContract, RouterContractClient } from "@orpc/contract";
import { APIError } from "./api-error";

const DEFAULT_TIMEOUT_MS = 30_000;

type FetchInit = RequestInit & {
	redirect?: Request["redirect"];
	priority?: "high" | "low" | "auto";
};

/** Configuration for an RPC client. The URL may be resolved for each request. */
export type ClientOptions = {
	/** Absolute server base URL or RPC endpoint; defaults to http://localhost:3000. A function resolves it for each request. */
	url?: string | (() => string);
	/** Fetch implementation used for RPC requests; defaults to the global fetch. */
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

// Accept a server base (including a reverse-proxy prefix) or an existing /api/rpc endpoint.
function rpcBaseUrl(url: string): string {
	const endpoint = new URL(url);
	const path = endpoint.pathname.replace(/\/+$/, "").replace(/\/api\/rpc$/, "");
	return endpoint.origin + path;
}

/**
 * Create a typed RPC client from a server base URL or an existing /api/rpc URL.
 * Requests time out after 30 seconds unless configured otherwise.
 *
 * @param options - Server URL, optional transport and request timeout.
 * @returns A client typed against the supplied router contract.
 * @throws If a static URL is invalid. A URL callback is evaluated when used.
 */
export function createClient<C extends RouterContract>(
	options: ClientOptions = {},
): RouterContractClient<C> {
	const url = options.url;
	const origin =
		typeof url === "function"
			? () => rpcBaseUrl(url())
			: rpcBaseUrl(url || "http://localhost:3000");
	const fetchImpl = createTimedFetch(
		options.fetch ?? ((request, init) => fetch(request, init)),
		options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
	);

	const link = new RPCLink({
		origin,
		url: "/api/rpc",
		fetch: fetchImpl,
	});

	return createORPCClient(link);
}
