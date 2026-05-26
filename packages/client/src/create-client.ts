import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

export type ClientOptions = {
	url?: string;
	fetch?: typeof fetch;
};

export function createClient(options: ClientOptions = {}) {
	const base = options.url || "http://localhost:3000";
	const rpcUrl = new URL("/api/rpc/", base).toString();

	const link = new RPCLink({
		url: rpcUrl,
		fetch: options.fetch,
	});

	return createORPCClient(link);
}
