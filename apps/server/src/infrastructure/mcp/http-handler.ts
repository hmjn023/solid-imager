import {
	createMcpHandler,
	hostHeaderValidationResponse,
	localhostAllowedHostnames,
	McpServer,
	originValidationResponse,
} from "@modelcontextprotocol/server";
import { McpRegistrar } from "@orpc/mcp";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { mediaToolsRouter } from "~/infrastructure/api/routers/media-tools-router";

const allowedHosts = [
	...localhostAllowedHostnames(),
	...(process.env.MCP_ALLOWED_HOSTS ?? "")
		.split(",")
		.map((host) => host.trim())
		.filter(Boolean),
];

const registrar = new McpRegistrar(mediaToolsRouter, {
	converters: [new ZodToJsonSchemaConverter()],
});
const handler = createMcpHandler(async ({ requestInfo }) => {
	const server = new McpServer({ name: "solid-imager", version: "0.0.0" });
	await registrar.register(server, {
		context: { headers: requestInfo?.headers },
	});
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
