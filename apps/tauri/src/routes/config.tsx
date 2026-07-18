import { configQueryKeys } from "@solid-imager/ui/query-options";
import { toQueryUiState } from "@solid-imager/ui/query-state";
import { ConfigStateScreen } from "@solid-imager/ui/screens/config-state-screen";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
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
		<ConfigStateScreen
			data={state().data}
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
