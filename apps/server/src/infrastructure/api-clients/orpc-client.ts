import { createRouterClient } from "@orpc/server";
import { createClient } from "@solid-imager/client";
import { createIsomorphicFn } from "@tanstack/solid-start";
import { getRequestHeaders } from "@tanstack/solid-start/server";
import { appRouter } from "~/domain/shared/api-contract";

const getORPCClient = createIsomorphicFn()
	.server(() => {
		return createRouterClient(appRouter, {
			context: () => ({
				headers: getRequestHeaders(),
			}),
		}) as any;
	})
	.client(() => {
		return createClient({ url: window.location.origin }) as any;
	});

export const client = getORPCClient();
export const orpc = getORPCClient();
