import { call, implement, ORPCError } from "@orpc/server";
import { configContract } from "@solid-imager/core/contract";
import { captureSearchSnapshotRequestSchema } from "@solid-imager/core/search";
import { services } from "~/infrastructure/service-registry";
import { searchSnapshotsRouter } from "./search-snapshots-router";

const os = implement(configContract);

export const configRouter = os.router({
	mcpCatalog: os.mcpCatalog.handler(async () => {
		const { catalogForSettings } = await import("~/infrastructure/mcp/catalog");
		return catalogForSettings();
	}),
	webTools: os.webTools.handler(async () => {
		const { publishedWebTools } = await import("~/infrastructure/mcp/catalog");
		return publishedWebTools(services.getConfigService().getConfig().mcp.web);
	}),
	callWebTool: os.callWebTool.handler(async ({ input, context, signal }) => {
		const { toolCatalog } = await import("~/infrastructure/mcp/catalog");
		if (input.name === "search_media_capture_snapshot") {
			if (
				!services
					.getConfigService()
					.getConfig()
					.mcp.web.includes("search_media")
			) {
				throw new ORPCError("NOT_FOUND", {
					message: "WebMCP tool is not published",
				});
			}
			return call(
				searchSnapshotsRouter.capture,
				captureSearchSnapshotRequestSchema.parse(input.arguments),
				{ context, signal },
			);
		}
		const tool = toolCatalog.get(input.name);
		if (
			!tool?.procedure ||
			!services.getConfigService().getConfig().mcp.web.includes(input.name)
		) {
			throw new ORPCError("NOT_FOUND", {
				message: "WebMCP tool is not published",
			});
		}
		return call(tool.procedure, input.arguments, { context, signal });
	}),
	get: os.get.handler(async () => services.getConfigService().getConfig()),

	update: os.update.handler(async ({ input }) => {
		await services.getConfigService().updateConfig(input);
		return services.getConfigService().getConfig();
	}),
});
