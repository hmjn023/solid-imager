import { configQueryKeys } from "@solid-imager/ui/query-options";
import { toQueryUiState } from "@solid-imager/ui/query-state";
import { V2ConfigStateScreen } from "@solid-imager/ui/screens/v2-config-state-screen";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { configQueryOptions } from "~/infrastructure/api-clients/queries";

export const Route = createFileRoute("/v2/config")({
	component: V2ConfigPage,
});

function V2ConfigPage() {
	const configQuery = createQuery(configQueryOptions);
	const queryClient = useQueryClient();

	return (
		<V2ConfigStateScreen
			data={configQuery.data}
			onRetry={async () => {
				await configQuery.refetch();
			}}
			onSubmit={async (value) => {
				await orpc.config.update(value);
				await queryClient.invalidateQueries({
					queryKey: configQueryKeys.all(),
				});
			}}
			state={toQueryUiState(configQuery)}
		/>
	);
}
