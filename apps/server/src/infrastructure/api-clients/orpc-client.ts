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
 * - SSRモード: ルーターを直接呼び出し (no HTTP)
 * - Webモード (ブラウザ): /api/rpc を介して fetch
 * - Tauriモード: 現時点では /api/rpc 経由 (Tauri direct call は #165 で対応予定)
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
