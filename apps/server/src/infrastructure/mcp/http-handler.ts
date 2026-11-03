import {
	createMcpHandler,
	hostHeaderValidationResponse,
	localhostAllowedHostnames,
	McpServer,
	originValidationResponse,
} from "@modelcontextprotocol/server";
import { McpRegistrar } from "@orpc/mcp";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { services } from "~/infrastructure/service-registry";
import { toolCatalog } from "./catalog";
import type { AnyProcedure } from "@orpc/server";

const allowedHosts = [
	...localhostAllowedHostnames(),
	...(process.env.MCP_ALLOWED_HOSTS ?? "")
		.split(",")
		.map((host) => host.trim())
		.filter(Boolean),
];

function makeRegistrar(names: string[]) {
	const router: Record<string, AnyProcedure> = {};
	for (const [name, tool] of toolCatalog) {
		if (tool.procedure && names.includes(name)) router[name] = tool.procedure;
	}
	return new McpRegistrar(router, {
		converters: [new ZodToJsonSchemaConverter({ cache: true })],
	});
}
let cached:
	| { names: string[]; registrar: ReturnType<typeof makeRegistrar> }
	| undefined;
const handler = createMcpHandler(async ({ requestInfo }) => {
	const server = new McpServer(
		{ name: "solid-imager", version: "0.0.0" },
		{ capabilities: { tools: {} } },
	);
	const names = services.getConfigService().getConfig().mcp.http;
	if (cached?.names !== names)
		cached = { names, registrar: makeRegistrar(names) };
	await cached.registrar.register(server, {
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
