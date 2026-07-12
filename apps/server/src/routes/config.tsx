import { configQueryKeys } from "@solid-imager/ui/query-options";
import { toQueryUiState } from "@solid-imager/ui/query-state";
import { RouteDataPendingScreen } from "@solid-imager/ui/router-status";
import { ConfigScreen } from "@solid-imager/ui/screens/config-screen";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { configQueryOptions } from "~/infrastructure/api-clients/queries";

export const Route = createFileRoute("/config")({
	ssr: true,
	loader: async ({ context }) => {
		const config = await context.queryClient.fetchQuery(configQueryOptions());
		return { config };
	},
	pendingComponent: () => (
		<RouteDataPendingScreen
			description="設定を準備しています..."
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
		<div class="container mx-auto max-w-4xl p-6">
			<Show when={state().phase === "pending" && config() === undefined}>
				<div class="py-10 text-center" role="status">
					Loading settings...
				</div>
			</Show>

			<Show
				when={
					(state().phase === "error" || state().phase === "offline") &&
					config() === undefined
				}
			>
				<div class="py-10 text-red-500" role="alert">
					{state().phase === "offline"
						? "Offline. Settings will load after reconnecting."
						: "Error loading settings."}
				</div>
			</Show>
			<Show when={state().fetchState === "background-fetching"}>
				<p class="mb-2 text-muted-foreground text-sm" role="status">
					Updating settings...
				</p>
			</Show>
			<Show
				when={state().fetchState === "paused" && state().data !== undefined}
			>
				<p class="mb-2 text-muted-foreground text-sm" role="status">
					Offline. Showing cached settings.
				</p>
			</Show>

			<Show when={config()}>
				{(data) => (
					<ConfigScreen
						data={data()}
						onSubmit={async (value) => {
							await orpc.config.update(value);
							await queryClient.invalidateQueries({
								queryKey: configQueryKeys.all(),
							});
						}}
					/>
				)}
			</Show>
		</div>
	);
}
