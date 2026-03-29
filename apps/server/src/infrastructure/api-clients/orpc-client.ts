import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createRouterClient } from "@orpc/server";
import { createIsomorphicFn } from "@tanstack/solid-start";
import { getRequestHeaders } from "@tanstack/solid-start/server";
import type { AppRouter } from "~/domain/shared/api-contract";
import { appRouter } from "~/domain/shared/api-contract";

/**
 * oRPC クライアントの生成
 * サーバーサイドではルーターを直接呼び出し、クライアントサイドでは /api/rpc を介して fetch を行う
 */
const getORPCClient = createIsomorphicFn()
	.server(() => {
		return createRouterClient(appRouter, {
			context: () => ({
				headers: getRequestHeaders(),
			}),
		}) as any;
	})
	.client((): RouterClient<AppRouter> => {
		const link = new RPCLink({
			url: `${window.location.origin}/api/rpc`,
		});
		return createORPCClient(link);
	});

export const orpc: RouterClient<AppRouter> = getORPCClient();
