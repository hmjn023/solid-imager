import { configQueryKeys } from "@solid-imager/ui/query-options";
import { toQueryUiState } from "@solid-imager/ui/query-state";
import { RouteDataPendingScreen } from "@solid-imager/ui/router-status";
import { ConfigStateScreen } from "@solid-imager/ui/screens/config-state-screen";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { configQueryOptions } from "~/infrastructure/api-clients/queries";
import type { RouteLoaderContext } from "~/infrastructure/router/route-types";

export const Route = createFileRoute("/config")({
	ssr: true,
	loader: async ({ context }: RouteLoaderContext) => {
		const config = await context.queryClient.fetchQuery(configQueryOptions());
		return { config };
	},
	pendingComponent: () => (
		<RouteDataPendingScreen
			class="max-w-4xl p-6"
			description="設定を準備しています..."
			layout="config"
			showAction
			title="Settings"
		/>
	),
	pendingMinMs: 0,
	component: ConfigPageContent,
});

function ConfigPageContent() {
	const loaderData = Route.useLoaderData();
	const configQuery = createQuery(configQueryOptions);
	const queryClient = useQueryClient();
	const state = () => toQueryUiState(configQuery);
	const config = () => configQuery.data ?? loaderData().config;

	return (
		<ConfigStateScreen
			data={config()}
			onRetry={async () => {
				await configQuery.refetch();
			}}
			onSubmit={async (value) => {
				await orpc.config.update(value);
				await queryClient.invalidateQueries({
					queryKey: configQueryKeys.all(),
				});
			}}
			state={state()}
		/>
	);
}
