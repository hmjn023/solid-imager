import { afterEach, describe, expect, it, vi } from "vitest";
import { APIError } from "./api-error";
import { createClient, createTimedFetch } from "./create-client";

type TestClient = {
	ai: Record<
		string,
		(input: object, options?: { signal?: AbortSignal }) => Promise<unknown>
	>;
};

function delayedClient(timeoutMs?: number): TestClient {
	return createClient({
		url: "http://localhost",
		timeoutMs,
		fetch: (_request, init) =>
			new Promise<Response>((resolve, reject) => {
				const timer = setTimeout(
					() => resolve(Response.json({ json: "completed" })),
					35_000,
				);
				init?.signal?.addEventListener(
					"abort",
					() => {
						clearTimeout(timer);
						reject(init.signal?.reason);
					},
					{ once: true },
				);
			}),
	}) as unknown as TestClient;
}

describe("RPC timeout budgets", () => {
	afterEach(() => vi.useRealTimers());
	it.each([
		"tag",
		"tagOppaiOracle",
		"ccipFeature",
		"ccipDifference",
		"ccipDistances",
		"detectAndCropCharacters",
	])(
		"allows %s inference to take longer than 30 seconds",
		async (procedure) => {
			vi.useFakeTimers();
			const pending = delayedClient().ai[procedure]({});
			const completed = expect(pending).resolves.toBe("completed");
			await vi.advanceTimersByTimeAsync(35_000);
			await completed;
		},
	);
	it.each(["health", "ccipVectorStatus", "startCcipExtraction"])(
		"keeps the 30-second budget for %s",
		async (procedure) => {
			vi.useFakeTimers();
			const pending = delayedClient().ai[procedure]({});
			const timedOut = expect(pending).rejects.toMatchObject({
				code: "TIMEOUT",
			});
			await vi.advanceTimersByTimeAsync(30_000);
			await timedOut;
		},
	);
	it("respects an explicitly configured inference timeout", async () => {
		vi.useFakeTimers();
		const timedOut = expect(
			delayedClient(1_000).ai.tag({}),
		).rejects.toMatchObject({ code: "TIMEOUT" });
		await vi.advanceTimersByTimeAsync(1_000);
		await timedOut;
	});
});

describe("createTimedFetch", () => {
	it("does not dispatch an already cancelled request", async () => {
		const fetchImpl = vi.fn();
		const controller = new AbortController();
		const reason = new Error("Caller disposed");
		controller.abort(reason);
		await expect(
			createTimedFetch(
				fetchImpl,
				30_000,
			)(new Request("http://localhost", { signal: controller.signal })),
		).rejects.toBe(reason);
		expect(fetchImpl).not.toHaveBeenCalled();
	});
	it("respects the explicit init signal override", async () => {
		const requestController = new AbortController();
		requestController.abort();
		const initController = new AbortController();
		const fetchImpl = vi.fn(async (_request: Request, init?: RequestInit) => {
			expect(init?.signal?.aborted).toBe(false);
			return new Response("ok");
		});
		const response = await createTimedFetch(fetchImpl, 30_000)(
			new Request("http://localhost", { signal: requestController.signal }),
			{ signal: initController.signal },
		);
		expect(await response.text()).toBe("ok");
	});
	it("releases an RPC transport when cancellation is carried on Request.signal", async () => {
		const signals: AbortSignal[] = [];
		const client = createClient({
			url: "http://localhost",
			fetch: async (_request, init) => {
				if (!init?.signal) throw new Error("Missing fetch signal");
				const signal = init.signal;
				signals.push(signal);
				return new Promise<Response>((_resolve, reject) => {
					signal.addEventListener("abort", () => reject(signal.reason), {
						once: true,
					});
				});
			},
		}) as unknown as TestClient;
		const controller = new AbortController();
		const pending = client.ai
			.health({}, { signal: controller.signal })
			.catch((error) => error);
		await vi.waitFor(() => expect(signals).toHaveLength(1));
		controller.abort();
		expect(signals[0]?.aborted).toBe(true);
		expect(await pending).toMatchObject({ name: "AbortError" });
	});
	it("releases all cancelled pending connections before their response headers", async () => {
		const signals: AbortSignal[] = [];
		const timedFetch = createTimedFetch(async (_request, init) => {
			if (!init?.signal) throw new Error("Missing fetch signal");
			const signal = init.signal;
			signals.push(signal);
			return new Promise<Response>((_resolve, reject) => {
				signal.addEventListener("abort", () => reject(signal.reason), {
					once: true,
				});
			});
		}, 30_000);
		const controller = new AbortController();
		const pending = Array.from({ length: 6 }, () =>
			timedFetch(
				new Request("http://localhost/api/rpc/sources/events", {
					signal: controller.signal,
				}),
			).catch((error) => error),
		);
		controller.abort();
		expect(signals.filter((signal) => signal.aborted)).toHaveLength(6);
		await Promise.all(pending);
	});
	it("propagates an upstream abort signal to fetch", async () => {
		const receivedSignals: AbortSignal[] = [];
		const fetchImpl = async (_request: Request, init?: RequestInit) => {
			if (init?.signal) {
				receivedSignals.push(init.signal);
			}
			return await new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => {
					reject(new DOMException("aborted", "AbortError"));
				});
			});
		};
		const timedFetch = createTimedFetch(fetchImpl, 1_000);
		const controller = new AbortController();
		const promise = timedFetch(new Request("http://localhost"), {
			signal: controller.signal,
		});

		controller.abort();

		await expect(promise).rejects.toMatchObject({ name: "AbortError" });
		expect(receivedSignals[0]?.aborted).toBe(true);
	});

	it("aborts fetch with an API timeout error", async () => {
		const fetchImpl = async (_request: Request, init?: RequestInit) =>
			await new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => {
					reject(init.signal?.reason);
				});
			});
		const timedFetch = createTimedFetch(fetchImpl, 1);

		await expect(timedFetch(new Request("http://localhost"))).rejects.toEqual(
			expect.any(APIError),
		);
	});

	it("downloads job artifacts as a raw stream", async () => {
		const requests: Request[] = [];
		const client = createClient({
			url: "http://localhost",
			fetch: async (request) => {
				requests.push(request.clone());
				return new Response(
					new ReadableStream({
						start(controller) {
							controller.enqueue(new TextEncoder().encode("tar"));
							controller.close();
						},
					}),
					{ headers: { "content-type": "application/octet-stream" } },
				);
			},
		}) as unknown as {
			jobs: {
				downloadArtifact: (
					input: { id: string },
					options?: { signal?: AbortSignal },
				) => Promise<ReadableStream<Uint8Array>>;
			};
		};

		const stream = await client.jobs.downloadArtifact({ id: "job-id" });
		const body = await new Response(stream).text();

		expect(body).toBe("tar");
		expect(requests).toHaveLength(1);
		expect(requests[0]?.url).toBe(
			"http://localhost/api/rpc/jobs/downloadArtifact",
		);
		expect(requests[0]?.method).toBe("POST");
		expect(await requests[0]?.json()).toEqual({ json: { id: "job-id" } });
	});
});
