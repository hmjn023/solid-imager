import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AnyContractRouter, ContractRouterClient } from "@orpc/contract";
import { APIError } from "./api-error";

const DEFAULT_TIMEOUT_MS = 30_000;
// Media inference observes a durable request for up to 180 seconds. Allow
// queueing/HTTP overhead as well, without extending normal reads and writes.
export const AI_REQUEST_TIMEOUT_MS = 240_000;
const inferencePath =
	/^\/api\/rpc\/ai\/(?:tag|tagOppaiOracle|ccipFeature|ccipDifference|ccipDistances|detectAndCropCharacters)\/?$/;

type FetchInit = RequestInit & {
	redirect?: Request["redirect"];
	priority?: "high" | "low" | "auto";
};

export type ClientOptions = {
	url?: string;
	fetch?: (request: Request, init?: FetchInit) => Promise<Response>;
	timeoutMs?: number;
};

type JobArtifactInput = { id: string };
type JobArtifactOptions = { signal?: AbortSignal };

function readProperty(
	target: object,
	property: PropertyKey,
	receiver: unknown,
): unknown {
	return Reflect.get(target, property, receiver);
}

// The server intentionally returns this root-level artifact as a raw stream.
// The regular oRPC JSON decoder cannot deserialize a stream body, so this one
// procedure must be fetched directly while the other procedures use RPCLink.
async function downloadJobArtifact(
	url: URL,
	fetchImpl: (request: Request, init?: FetchInit) => Promise<Response>,
	input: JobArtifactInput,
	options?: JobArtifactOptions,
): Promise<ReadableStream<Uint8Array>> {
	const response = await fetchImpl(
		new Request(url, {
			method: "POST",
			headers: {
				accept: "application/octet-stream",
				"content-type": "application/json",
			},
			body: JSON.stringify({ json: input }),
			signal: options?.signal,
		}),
		{ signal: options?.signal },
	);

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new APIError(
			body || `Artifact download failed with status ${response.status}`,
			"SERVER_ERROR",
		);
	}
	if (!response.body) {
		throw new APIError(
			"Artifact download returned an empty body",
			"SERVER_ERROR",
		);
	}

	return response.body;
}

function withStreamingJobArtifactDownload<C extends AnyContractRouter>(
	client: ContractRouterClient<C>,
	artifactUrl: URL,
	fetchImpl: (request: Request, init?: FetchInit) => Promise<Response>,
): ContractRouterClient<C> {
	return new Proxy(client as object, {
		get(target, property, receiver) {
			if (property !== "jobs") {
				return readProperty(target, property, receiver);
			}

			const jobs = readProperty(target, property, receiver);
			if (typeof jobs !== "function") {
				return jobs;
			}

			return new Proxy(jobs, {
				get(jobsTarget, jobsProperty, jobsReceiver) {
					if (jobsProperty !== "downloadArtifact") {
						return readProperty(jobsTarget, jobsProperty, jobsReceiver);
					}

					return (input: JobArtifactInput, options?: JobArtifactOptions) =>
						downloadJobArtifact(artifactUrl, fetchImpl, input, options);
				},
			});
		},
	}) as ContractRouterClient<C>;
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

		// oRPC carries caller cancellation on Request.signal; fetch init normally
		// contains only redirect options. Explicit init signals override it, as
		// they do in native fetch. Dropping the request signal leaves cancelled
		// reads/subscriptions occupying connections until their timeout expires.
		const upstreamSignal =
			init?.signal === undefined ? request.signal : init.signal;
		const signal = upstreamSignal
			? AbortSignal.any([upstreamSignal, controller.signal])
			: controller.signal;

		try {
			signal.throwIfAborted();
			return await fetchImpl(request, { ...init, signal });
		} catch (error) {
			if (signal.aborted) throw signal.reason;
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
	const baseFetch =
		options.fetch ??
		((request: Request, init?: FetchInit) => fetch(request, init));
	const defaultFetch = createTimedFetch(
		baseFetch,
		options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
	);
	const inferenceFetch = createTimedFetch(
		baseFetch,
		options.timeoutMs ?? AI_REQUEST_TIMEOUT_MS,
	);
	const fetchImpl = (request: Request, init?: FetchInit) =>
		inferencePath.test(new URL(request.url).pathname)
			? inferenceFetch(request, init)
			: defaultFetch(request, init);

	const link = new RPCLink({
		url: rpcUrl,
		fetch: fetchImpl,
	});

	const client = createORPCClient(link) as ContractRouterClient<C>;
	const artifactUrl = new URL("jobs/downloadArtifact", rpcUrl);
	return withStreamingJobArtifactDownload(client, artifactUrl, fetchImpl);
}
