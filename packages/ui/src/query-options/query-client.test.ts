import { QueryClient } from "@tanstack/solid-query";
import { describe, expect, it } from "vitest";
import {
	createAppQueryClientConfig,
	QUERY_GC_TIME_MS,
	QUERY_STALE_TIME_MS,
} from "./query-client";

describe("createAppQueryClientConfig", () => {
	it("provides shared server and Tauri defaults", () => {
		const config = createAppQueryClientConfig(() => true);
		const queries = config.defaultOptions?.queries;

		expect(queries).toMatchObject({
			gcTime: QUERY_GC_TIME_MS,
			networkMode: "online",
			refetchOnReconnect: true,
			refetchOnWindowFocus: false,
			staleTime: QUERY_STALE_TIME_MS,
		});
		expect(config.defaultOptions?.mutations?.retry).toBe(false);
	});

	it("retries transient failures at most twice", () => {
		const retry = createAppQueryClientConfig(
			(error) => error instanceof TypeError,
		).defaultOptions?.queries?.retry;

		expect(typeof retry).toBe("function");
		if (typeof retry !== "function") {
			throw new Error("retry must be a function");
		}
		expect(retry(0, new TypeError("network"))).toBe(true);
		expect(retry(1, new TypeError("network"))).toBe(true);
		expect(retry(2, new TypeError("network"))).toBe(false);
		expect(retry(0, new Error("validation"))).toBe(false);
	});

	it("does not surface auxiliary prefetch failures", async () => {
		const queryClient = new QueryClient(
			createAppQueryClientConfig(() => false),
		);

		await expect(
			queryClient.prefetchQuery({
				queryKey: ["auxiliary"],
				queryFn: () => Promise.reject(new Error("unavailable")),
			}),
		).resolves.toBeUndefined();
	});
});
