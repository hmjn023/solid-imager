import "@tanstack/solid-start/server-only";

import type { RouterClient } from "@orpc/server";
import { createRouterClient } from "@orpc/server";
import { getRequestHeaders } from "@tanstack/solid-start/server";
import type { AppRouter } from "~/domain/shared/api-contract";
import { appRouter } from "~/domain/shared/api-contract";

export const serverAppClient: RouterClient<AppRouter> = createRouterClient(
	appRouter,
	{
		context: () => ({
			headers: getRequestHeaders(),
		}),
	},
);
