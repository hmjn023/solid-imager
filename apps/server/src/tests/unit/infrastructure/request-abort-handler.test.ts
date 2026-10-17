import { afterEach, describe, expect, it, vi } from "vitest";
import { requestHandler } from "@tanstack/start-server-core";
import { withRequestAbortHandling } from "~/infrastructure/http/request-abort-handler";

describe("server request cancellation", () => {
	afterEach(() => vi.restoreAllMocks());
	it("returns 499 without an unhandled error through TanStack's H3 boundary", async () => {
		const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
		const controller = new AbortController();
		const request = new Request("http://localhost/api/rpc/imports/events", {
			signal: controller.signal,
		});
		const handler = withRequestAbortHandling(
			requestHandler(
				(req) =>
					new Promise<Response>((_resolve, reject) => {
						req.signal.addEventListener(
							"abort",
							() => reject(req.signal.reason),
							{
								once: true,
							},
						);
					}),
			),
		);
		const pending = handler(request);
		controller.abort(
			new DOMException("The connection was closed.", "AbortError"),
		);
		expect((await pending).status).toBe(499);
		expect(errorLog).not.toHaveBeenCalled();
	});
	it("handles a transport that was already disconnected before dispatch", async () => {
		const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
		const controller = new AbortController();
		controller.abort();
		const handler = withRequestAbortHandling(
			requestHandler(async (request) => {
				request.signal.throwIfAborted();
				return new Response("unexpected");
			}),
		);
		const response = await handler(
			new Request("http://localhost", { signal: controller.signal }),
		);
		expect(response.status).toBe(499);
		expect(errorLog).not.toHaveBeenCalled();
	});
	it("still cancels a stream after H3 has returned its response headers", async () => {
		const controller = new AbortController();
		const onAbort = vi.fn();
		const handler = withRequestAbortHandling(
			requestHandler(
				async (request) =>
					new Response(
						new ReadableStream({
							start(stream) {
								stream.enqueue(new TextEncoder().encode(": connected\n\n"));
								request.signal.addEventListener("abort", () => {
									onAbort();
									stream.close();
								});
							},
						}),
						{ headers: { "content-type": "text/event-stream" } },
					),
			),
		);
		const response = await handler(
			new Request("http://localhost/api/rpc/imports/events", {
				signal: controller.signal,
			}),
		);
		const reader = response.body?.getReader();
		if (!reader) throw new Error("Missing event stream body");
		expect((await reader.read()).done).toBe(false);
		controller.abort();
		expect((await reader.read()).done).toBe(true);
		expect(onAbort).toHaveBeenCalledOnce();
	});
	it("keeps the native request and upload body intact", async () => {
		const request = new Request("http://localhost/api/rpc/imports/bulkAdd", {
			method: "POST",
			body: "bulk metadata",
		});
		const handler = withRequestAbortHandling(
			requestHandler(async (received) => {
				expect(received).toBe(request);
				return new Response(await received.text());
			}),
		);
		expect(await (await handler(request)).text()).toBe("bulk metadata");
	});
	it("still reports real H3 handler failures as unhandled 500s", async () => {
		const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
		const failure = new Error("Database failed");
		const handler = withRequestAbortHandling(
			requestHandler(async () => {
				throw failure;
			}),
		);
		expect((await handler(new Request("http://localhost"))).status).toBe(500);
		expect(errorLog).toHaveBeenCalledOnce();
		expect(errorLog).toHaveBeenCalledWith(
			expect.objectContaining({ cause: failure }),
		);
	});
	it.each(["/api/rpc/ai/tag", "/api/rpc/ai/ccipFeature"])(
		"extends Bun's timeout for %s",
		async (pathname) => {
			const timeout = vi.fn();
			const request = Object.assign(
				new Request(`http://localhost${pathname}`),
				{
					runtime: { name: "bun", bun: { server: { timeout } } },
				},
			);
			const handler = withRequestAbortHandling(() => new Response("ok"));
			await handler(request);
			expect(timeout).toHaveBeenCalledWith(request, 240);
		},
	);
	it.each(["/api/rpc/ai/ccipVectorStatus", "/api/rpc/jobs/events"])(
		"preserves Bun's timeout for %s",
		async (pathname) => {
			const timeout = vi.fn();
			const request = Object.assign(
				new Request(`http://localhost${pathname}`),
				{
					runtime: { name: "bun", bun: { server: { timeout } } },
				},
			);
			await withRequestAbortHandling(() => new Response("ok"))(request);
			expect(timeout).not.toHaveBeenCalled();
		},
	);
	it("preserves a successful response", async () => {
		const response = new Response("ok");
		const handler = withRequestAbortHandling(() => response);
		expect(await handler(new Request("http://localhost"))).toBe(response);
	});
	it("returns 499 when the client disconnects during a pending request", async () => {
		const controller = new AbortController();
		const request = new Request("http://localhost/api/rpc/ai/tag", {
			signal: controller.signal,
		});
		const handler = withRequestAbortHandling(
			(req) =>
				new Promise((_resolve, reject) => {
					req.signal.addEventListener(
						"abort",
						() => reject(req.signal.reason),
						{ once: true },
					);
				}),
		);
		const pending = handler(request);
		controller.abort(
			new DOMException("The connection was closed.", "AbortError"),
		);
		const response = await pending;
		expect(response.status).toBe(499);
		expect(await response.text()).toBe("");
	});
	it("does not hide an upstream AbortError on a connected request", async () => {
		const failure = new DOMException("AI timed out", "AbortError");
		const handler = withRequestAbortHandling(() => {
			throw failure;
		});
		await expect(handler(new Request("http://localhost"))).rejects.toBe(
			failure,
		);
	});
	it("does not hide a different failure that races with a disconnect", async () => {
		const controller = new AbortController();
		controller.abort();
		const failure = new Error("Database failed");
		const handler = withRequestAbortHandling(() => {
			throw failure;
		});
		await expect(
			handler(new Request("http://localhost", { signal: controller.signal })),
		).rejects.toBe(failure);
	});
});
