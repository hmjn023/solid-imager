import { createRouterClient } from "@orpc/server";
import { createClient } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/domain/contract";
import { createIsomorphicFn } from "@tanstack/solid-start";
import { getRequestHeaders } from "@tanstack/solid-start/server";
import { appRouter } from "~/infrastructure/api/app-router";

const getORPCClient = createIsomorphicFn()
	.server(() => {
		if (process.env.E2E === "1" && process.env.E2E_MODE === "dev") {
			const port = process.env.E2E_PORT;
			if (!port) {
				throw new Error("E2E_PORT must be set for the dev E2E RPC client");
			}
			return createClient<AppContract>({
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
		return createClient<AppContract>({ url: window.location.origin });
	});

export const client = getORPCClient();
export const orpc = getORPCClient();
