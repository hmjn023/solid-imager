import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AnyContractRouter, ContractRouterClient } from "@orpc/contract";
import { APIError } from "./api-error";

const DEFAULT_TIMEOUT_MS = 30_000;

type FetchInit = RequestInit & {
	redirect?: Request["redirect"];
	priority?: "high" | "low" | "auto";
};

export type ClientOptions = {
	url?: string;
	fetch?: (request: Request, init?: FetchInit) => Promise<Response>;
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

export function createTimedFetch(
	fetchImpl: (request: Request, init?: FetchInit) => Promise<Response>,
	timeoutMs: number,
): (request: Request, init?: FetchInit) => Promise<Response> {
	return async (request, init) => {
		const controller = new AbortController();
		const timeout = setTimeout(() => {
			controller.abort(createTimeoutError(timeoutMs));
		}, timeoutMs);

		const upstreamSignal = init?.signal;
		const signal = upstreamSignal
			? AbortSignal.any([upstreamSignal, controller.signal])
			: controller.signal;

		try {
			return await fetchImpl(request, { ...init, signal });
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

export function createClient<C extends AnyContractRouter>(
	options: ClientOptions = {},
): ContractRouterClient<C> {
	const base = options.url || "http://localhost:3000";
	const rpcUrl = new URL("/api/rpc/", base).toString();
	const fetchImpl = createTimedFetch(
		options.fetch ?? ((request, init) => fetch(request, init)),
		options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
	);

	const link = new RPCLink({
		url: rpcUrl,
		fetch: fetchImpl,
	});

	return createORPCClient(link) as ContractRouterClient<C>;
}
