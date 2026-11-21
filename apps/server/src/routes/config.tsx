import { createFileRoute } from "@tanstack/solid-router";
import { isServer } from "solid-js/web";
import { ConfigPage } from "~/components/pages/config-page";
import { configQueryOptions } from "~/infrastructure/api-clients/queries";
import type { RouteLoaderContext } from "~/infrastructure/router/route-types";

export const Route = createFileRoute("/config")({
	loader: async ({ context }: RouteLoaderContext) => {
		if (isServer)
			await context.queryClient
				.query(configQueryOptions())
				.catch(() => undefined);
	},
	component: ConfigPage,
});
