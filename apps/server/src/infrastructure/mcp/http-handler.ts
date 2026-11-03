import {
	createMcpHandler,
	hostHeaderValidationResponse,
	localhostAllowedHostnames,
	McpServer,
	originValidationResponse,
} from "@modelcontextprotocol/server";
import { createRouterClient } from "@orpc/server";
import type { z } from "zod";
import { appRouter } from "~/infrastructure/api/app-router";
import { createMediaTools } from "./media-tools";

const allowedHosts = [
	...localhostAllowedHostnames(),
	...(process.env.MCP_ALLOWED_HOSTS ?? "")
		.split(",")
		.map((host) => host.trim())
		.filter(Boolean),
];

const handler = createMcpHandler(({ requestInfo }) => {
	const orpc = createRouterClient(appRouter, {
		context: { headers: requestInfo?.headers },
	});
	const server = new McpServer({ name: "solid-imager", version: "0.0.0" });
	for (const tool of createMediaTools(orpc)) {
		const inputSchema: z.ZodObject = tool.inputSchema;
		server.registerTool(
			tool.name,
			{
				description: tool.description,
				inputSchema,
				annotations: {
					readOnlyHint: tool.readOnly,
					idempotentHint: tool.idempotent,
					openWorldHint: false,
				},
			},
			async (args, ctx) => {
				const result = await tool.execute(args, ctx.mcpReq.signal);
				return {
					content: [{ type: "text", text: JSON.stringify(result) }],
					structuredContent: result,
				};
			},
		);
	}
	return server;
});

export function handleMcpRequest(request: Request, initialize: () => void) {
	const rejected =
		hostHeaderValidationResponse(request, allowedHosts) ??
		originValidationResponse(request, allowedHosts);
	if (rejected) return rejected;
	initialize();
	return handler.fetch(request);
}
