import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createRouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createIsomorphicFn } from "@tanstack/solid-start";
import { getRequestHeaders } from "@tanstack/solid-start/server";
import { isServer } from "solid-js/web";

import { appRouter as router } from "~/domain/shared/api-contract";

const getORPCClient = createIsomorphicFn()
	.server(() => {
		// On server, we can use createRouterClient to call the router directly
		// without making a real HTTP request.
		return createRouterClient(router, {
			context: () => ({
				headers: getRequestHeaders(),
			}),
		}) as any;
	})
	.client((): RouterClient<typeof router> => {
		const link = new RPCLink({
			url: `${window.location.origin}/api/rpc`,
		});
		return createORPCClient(link);
	});

export const client: RouterClient<typeof router> = getORPCClient();

export const orpc = createTanstackQueryUtils(client);
