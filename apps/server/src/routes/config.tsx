import { createQuery } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { configQueryOptions } from "~/infrastructure/api-clients/queries/config-query";
import { ConfigForm } from "./config/config-form";

export const Route = createFileRoute("/config")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(configQueryOptions());
	},
	component: ConfigPage,
});

function ConfigPage() {
	const configQuery = createQuery(() => configQueryOptions());

	return (
		<div class="container mx-auto max-w-4xl p-6">
			<Show when={configQuery.isLoading}>
				<div class="py-10 text-center">Loading settings...</div>
			</Show>

			<Show when={configQuery.isError}>
				<div class="py-10 text-red-500">Error loading settings.</div>
			</Show>

			<Show when={configQuery.data}>
				{(data) => <ConfigForm data={data()} />}
			</Show>
		</div>
	);
}
