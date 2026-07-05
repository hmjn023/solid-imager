import { ConfigScreen } from "@solid-imager/ui/screens/config-screen";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { configQueryOptions } from "~/infrastructure/api-clients/queries";

export const Route = createFileRoute("/config")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(configQueryOptions());
	},
	component: ConfigPage,
});

function ConfigPage() {
	const configQuery = createQuery(() => configQueryOptions());
	const queryClient = useQueryClient();

	return (
		<div class="container mx-auto max-w-4xl p-6">
			<Show when={configQuery.isLoading}>
				<div class="py-10 text-center">Loading settings...</div>
			</Show>

			<Show when={configQuery.isError}>
				<div class="py-10 text-red-500">Error loading settings.</div>
			</Show>

			<Show when={configQuery.data}>
				{(data) => (
					<ConfigScreen
						data={data()}
						onSubmit={async (value) => {
							await orpc.config.update(value);
							await queryClient.invalidateQueries({ queryKey: ["config"] });
						}}
					/>
				)}
			</Show>
		</div>
	);
}
