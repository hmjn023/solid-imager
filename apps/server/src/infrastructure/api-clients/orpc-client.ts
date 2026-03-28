import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createIsomorphicFn } from "@tanstack/solid-start";
import { getRequestHeaders } from "@tanstack/solid-start/server";
import type { AppRouter } from "~/domain/shared/api-contract";

const getHeaders = createIsomorphicFn()
	.client(() => ({}))
	.server(() => getRequestHeaders());

const link = new RPCLink({
	url: "/api/rpc",
	headers: () => getHeaders(),
});

/**
 * oRPC クライアント
 * 型安全な API 呼び出しを提供
 */
export const orpc: RouterClient<AppRouter> = createORPCClient(link);
