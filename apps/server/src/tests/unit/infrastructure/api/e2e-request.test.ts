import { OpenAPISerializer } from "@orpc/openapi";
import type { APIRequestContext } from "@playwright/test";
import { expect, it, vi } from "vitest";
import { apiRequest } from "../../../e2e/support/api";

it("retains nested and repeated values in OpenAPI fixture query strings", async () => {
	const dispatched = new Error("Fixture request dispatched");
	const fetch = vi.fn<
		(...args: Parameters<APIRequestContext["fetch"]>) => Promise<never>
	>(async () => {
		throw dispatched;
	});
	const params = { labels: ["a+b", "c & d"], include: true };
	await expect(
		apiRequest({ fetch }, "jobs/list", {
			params,
			limit: 2,
			missing: undefined,
		}),
	).rejects.toBe(dispatched);

	const [url, options] = fetch.mock.calls[0];
	const requestUrl = new URL(
		typeof url === "string" ? url : url.url(),
		"http://localhost",
	);
	expect(requestUrl.pathname).toBe("/api/jobs");
	expect(new OpenAPISerializer().deserialize(requestUrl.searchParams)).toEqual({
		params: { labels: params.labels, include: "true" },
		limit: "2",
	});
	expect(options?.method).toBe("GET");
	expect(options?.data).toBeUndefined();
});
