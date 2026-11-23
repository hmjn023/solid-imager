import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { describe, expect, it } from "vitest";
import { APIError } from "./api-error";
import { createClient, createTimedFetch } from "./create-client";

describe("createClient", () => {
	it("uses the method from the contract and resolves the current server mount", async () => {
		const sources = [{ id: "source-1" }];
		const requests: { method?: string; url: string }[] = [];
		const contract = {
			list: oc.meta(openapi({ method: "GET", path: "/sources" })),
		};
		let base = "http://localhost:3000/";
		const client = createClient(contract, {
			url: () => base,
			fetch: async (url, init) => {
				requests.push({ method: init?.method, url });
				return Response.json(sources);
			},
		});

		await expect(client.list()).resolves.toEqual(sources);
		base = "https://example.com/imager/";
		await expect(client.list()).resolves.toEqual(sources);
		expect(requests).toEqual([
			{ method: "GET", url: "http://localhost:3000/api/sources" },
			{ method: "GET", url: "https://example.com/imager/api/sources" },
		]);
	});
});

describe("createTimedFetch", () => {
	it("propagates an upstream abort signal to fetch", async () => {
		const receivedSignals: AbortSignal[] = [];
		const fetchImpl = async (_url: string, init?: RequestInit) => {
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
		const promise = timedFetch("http://localhost", {
			signal: controller.signal,
		});

		controller.abort();

		await expect(promise).rejects.toMatchObject({ name: "AbortError" });
		expect(receivedSignals[0]?.aborted).toBe(true);
	});

	it("aborts fetch with an API timeout error", async () => {
		const fetchImpl = async (_url: string, init?: RequestInit) =>
			await new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => {
					reject(init.signal?.reason);
				});
			});
		const timedFetch = createTimedFetch(fetchImpl, 1);

		await expect(timedFetch("http://localhost")).rejects.toEqual(
			expect.any(APIError),
		);
	});
});
