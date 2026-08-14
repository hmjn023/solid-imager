import { createRouterClient } from "@orpc/server";
import { createClient } from "@solid-imager/client";
import { createIsomorphicFn } from "@tanstack/solid-start";
import { getRequestHeaders } from "@tanstack/solid-start/server";
import { appRouter } from "~/domain/shared/api-contract";

const getORPCClient = createIsomorphicFn()
	.server(() => {
		if (process.env.E2E === "1" && process.env.E2E_MODE === "dev") {
			const port = process.env.E2E_PORT;
			if (!port) {
				throw new Error("E2E_PORT must be set for the dev E2E RPC client");
			}
			return createClient<typeof appRouter>({
				url: `http://127.0.0.1:${port}`,
			});
		}
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
