import { configQueryKeys } from "@solid-imager/ui/query-options";
import { toQueryUiState } from "@solid-imager/ui/query-state";
import { ConfigScreen } from "@solid-imager/ui/screens/config-screen";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { configQueryOptions } from "~/queries";

export const Route = createFileRoute("/config")({
	loader: ({ context }) => {
		void context.queryClient.prefetchQuery(configQueryOptions());
	},
	component: ConfigPage,
});

function ConfigPage() {
	const configQuery = createQuery(() => configQueryOptions());
	const queryClient = useQueryClient();
	const state = () => toQueryUiState(configQuery);

	return (
		<div class="container mx-auto max-w-4xl p-6">
			<Show when={state().phase === "pending"}>
				<div class="py-10 text-center">Loading settings...</div>
			</Show>

			<Show when={state().phase === "error" || state().phase === "offline"}>
				<div class="py-10 text-red-500">
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

			<Show when={state().data}>
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
