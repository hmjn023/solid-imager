import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "~/domain/shared/api-contract";

const link = new RPCLink({
	url: () => `${window.location.origin}/api/rpc`,
});

export const webAppClient: RouterClient<AppRouter> = createORPCClient(link);
