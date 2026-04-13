import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { TaggingResponse } from "@solid-imager/core/domain/tagging/schemas";

const DEFAULT_SERVER_BASE_URL = "http://localhost:3000";

function getServerBaseUrl() {
	const configured = import.meta.env.VITE_SERVER_BASE_URL;
	return configured?.trim() || DEFAULT_SERVER_BASE_URL;
}

type ServerOrpcClient = {
	ai: {
		tag(input: { file: File }): Promise<TaggingResponse>;
	};
};

export function createServerOrpcClient(): ServerOrpcClient {
	const link = new RPCLink({
		url: `${getServerBaseUrl().replace(/\/$/, "")}/api/rpc`,
	});
	return createORPCClient(link) as ServerOrpcClient;
}

export const serverOrpc = createServerOrpcClient();
