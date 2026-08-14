import { os } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ResponseHeadersPlugin } from "@orpc/server/plugins";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createRpcResponseHeaders } from "~/infrastructure/api/rpc-response-headers";

describe("RPC response headers", () => {
	it("marks job artifact streams as binary responses", async () => {
		const router = {
			jobs: {
				downloadArtifact: os.output(z.instanceof(ReadableStream)).handler(
					async () =>
						new ReadableStream({
							start(controller) {
								controller.enqueue(new TextEncoder().encode("tar"));
								controller.close();
							},
						}),
				),
			},
		} as const;
		const handler = new RPCHandler(router, {
			plugins: [new ResponseHeadersPlugin()],
		});
		const request = new Request(
			"http://localhost/api/rpc/jobs/downloadArtifact",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ json: null }),
			},
		);

		const result = await handler.handle(request, {
			prefix: "/api/rpc",
			context: { resHeaders: createRpcResponseHeaders(request.url) },
		});

		expect(result.matched).toBe(true);
		expect(result.response?.headers.get("content-type")).toBe(
			"application/octet-stream",
		);
		const response = result.response as Response;
		const artifact = await response.blob();
		expect(artifact.type).toBe("application/octet-stream");
		expect(await artifact.text()).toBe("tar");
	});

	it("does not mark regular RPC responses as binary", () => {
		expect(
			createRpcResponseHeaders(
				"http://localhost/api/rpc/jobs/get?data=%7B%22json%22%3Anull%7D",
			).has("content-type"),
		).toBe(false);
	});
});
