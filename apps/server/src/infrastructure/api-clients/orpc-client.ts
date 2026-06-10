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
		});
	})
	.client(() => {
		return createClient<typeof appRouter>({ url: window.location.origin });
	});

export const client = getORPCClient();
export const orpc = getORPCClient();
