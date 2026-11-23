import { implement } from "@orpc/server";
import type { ResponseHeadersHandlerPluginContext } from "@orpc/server/plugins";
import { appContract } from "@solid-imager/core/contract";

export const healthRouter = implement(appContract.health)
	.$context<ResponseHeadersHandlerPluginContext>()
	.handler(({ context }) => {
		context.resHeaders?.set("cache-control", "no-store");
		return { service: "solid-imager", status: "ok" };
	});
