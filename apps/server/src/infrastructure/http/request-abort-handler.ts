import type { Register } from "@tanstack/solid-router";
import type { RequestHandler } from "@tanstack/solid-start/server";
import type { ServerRequest } from "nitro/types";
import { HTTPError } from "nitro/h3";
import { AI_REQUEST_TIMEOUT_MS } from "@solid-imager/client";
import { isAiInferenceRequest } from "../ai/ai-request-admission";

function normalizeTransportAbort(request: Request): void {
	const transportSignal = request.signal;
	const controller = new AbortController();
	const onAbort = () =>
		controller.abort(
			new HTTPError({
				status: 499,
				message: "Client Closed Request",
				cause: transportSignal.reason,
			}),
		);
	// Start converts rejected handlers to H3 responses before our outer catch.
	// Give that boundary a handled HTTP error as the transport abort reason.
	// Keep the native request identity/body/runtime for Bun's per-request timeout.
	Object.defineProperty(request, "signal", {
		value: controller.signal,
		configurable: true,
	});
	if (transportSignal.aborted) onAbort();
	else transportSignal.addEventListener("abort", onAbort, { once: true });
	// The signal must stay connected after headers resolve: oRPC iterators use
	// it to unsubscribe when the streaming response's client disconnects.
}

/** Keep TanStack's request cancellation from becoming an unhandled H3 500. */
export function withRequestAbortHandling(
	handler: RequestHandler<Register>,
): RequestHandler<Register> {
	return async (...args) => {
		const [request] = args;
		normalizeTransportAbort(request);
		try {
			if (isAiInferenceRequest(request.url)) {
				// Nitro's Bun adapter exposes the native server on the request.
				// Extend this request only; normal HTTP and SSE keep their policies.
				const serverRequest: ServerRequest = request;
				serverRequest.runtime?.bun?.server.timeout(
					request,
					AI_REQUEST_TIMEOUT_MS / 1_000,
				);
			}
			return await handler(...args);
		} catch (error) {
			// Match the actual transport cancellation, not unrelated failures that
			// happen to race with a disconnect or an AbortError from an AI service.
			if (request.signal.aborted && error === request.signal.reason) {
				return new Response(null, { status: 499 });
			}
			throw error;
		}
	};
}
