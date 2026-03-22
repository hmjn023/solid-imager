import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "~/domain/shared/api-contract";

/**
 * Get the base URL for oRPC
 * In browser: use current origin
 * In SSR: use localhost (fallback)
 */
export function getBaseUrl(): string {
	if (typeof window !== "undefined") {
		return `${window.location.origin}/api/rpc`;
	}
	return "http://localhost:3000/api/rpc";
}

const link = new RPCLink({
	url: getBaseUrl(),
});

/**
 * oRPC クライアント
 * 型安全な API 呼び出しを提供
 */
export const orpc: RouterClient<AppRouter> = createORPCClient(link);
