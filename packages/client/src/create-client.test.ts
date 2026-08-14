import { describe, expect, it } from "vitest";
import { APIError } from "./api-error";
import { createClient, createTimedFetch } from "./create-client";

describe("createTimedFetch", () => {
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
