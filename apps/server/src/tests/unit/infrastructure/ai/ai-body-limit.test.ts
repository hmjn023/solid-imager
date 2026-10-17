import { os } from "@orpc/server";
import { BodyLimitPlugin, RPCHandler } from "@orpc/server/fetch";
import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("AI fetch body limit using tiny payloads", () => {
	it("rejects a streaming body without Content-Length before running inference", async () => {
		let invoked = false;
		const handler = new RPCHandler(
			{
				ai: {
					tag: os.input(z.unknown()).handler(() => {
						invoked = true;
						return true;
					}),
				},
			},
			{
				plugins: [new BodyLimitPlugin({ maxBodySize: 64 })],
			},
		);
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(
					new TextEncoder().encode(JSON.stringify({ json: "x".repeat(80) })),
				);
				controller.close();
			},
		});
		const init: RequestInit & { duplex: "half" } = {
			method: "POST",
			body,
			duplex: "half",
			headers: { "content-type": "application/json" },
		};
		const result = await handler.handle(
			new Request("http://localhost/api/rpc/ai/tag", init),
			{ prefix: "/api/rpc" },
		);
		expect(result.response?.status).toBe(413);
		expect(invoked).toBe(false);
	});
});
