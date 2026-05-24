import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AppRouter } from "@solid-imager/server/api-contract";

export function getClient(url: string) {
	const remoteUrl = url || "http://localhost:3000";

	// Ensure protocol
	let base = remoteUrl;
	if (!/^https?:\/\//.test(base)) {
		base = `http://${base}`;
	}

	// Use URL object for safe path joining
	const rpcUrl = new URL("/api/rpc/", base).toString();

	const fetchLink = new RPCLink({
		url: rpcUrl,
		fetch: fetch,
	});
	return createORPCClient<AppRouter>(fetchLink);
}
