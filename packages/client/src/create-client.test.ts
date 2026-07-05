import { describe, expect, it } from "vitest";
import { APIError } from "./api-error";
import { createTimedFetch } from "./create-client";

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
});
