import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient, AnyContractRouter } from "@orpc/contract";

export type ClientOptions = {
	url?: string;
	fetch?: (
		request: Request,
		init?: RequestInit & { redirect?: Request["redirect"] },
	) => Promise<Response>;
};

export function createClient<C extends AnyContractRouter>(
	options: ClientOptions = {},
): ContractRouterClient<C> {
	const base = options.url || "http://localhost:3000";
	const rpcUrl = new URL("/api/rpc/", base).toString();

	const link = new RPCLink({
		url: rpcUrl,
		fetch: options.fetch,
	});

	return createORPCClient(link) as ContractRouterClient<C>;
}
