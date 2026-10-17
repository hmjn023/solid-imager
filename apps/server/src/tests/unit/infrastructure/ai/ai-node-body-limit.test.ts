import { createServer } from "node:http";
import { os } from "@orpc/server";
import { BodyLimitPlugin, RPCHandler } from "@orpc/server/node";
import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("AI node body limit using tiny payloads", () => {
	it("bounds chunked uploads before inference", async () => {
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
		const server = createServer((req, res) => {
			void handler.handle(req, res, { prefix: "/api/rpc" }).catch(() => {
				res.writeHead(500);
				res.end();
			});
		});
		await new Promise<void>((resolve) =>
			server.listen(0, "127.0.0.1", resolve),
		);
		try {
			const address = server.address();
			if (!address || typeof address === "string")
				throw new Error("Missing test port");
			const init: RequestInit & { duplex: "half" } = {
				method: "POST",
				duplex: "half",
				headers: { "content-type": "application/json" },
				signal: AbortSignal.timeout(2000),
				body: new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode(
								JSON.stringify({ json: "x".repeat(80) }),
							),
						);
						controller.close();
					},
				}),
			};
			const response = await fetch(
				`http://127.0.0.1:${address.port}/api/rpc/ai/tag`,
				init,
			);
			expect(response.status).toBe(413);
			expect(invoked).toBe(false);
		} finally {
			server.closeAllConnections();
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			);
		}
	});
});
