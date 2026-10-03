import { configQueryKeys } from "@solid-imager/ui/query-options";
import { toQueryUiState } from "@solid-imager/ui/query-state";
import { ConfigStateScreen } from "@solid-imager/ui/screens/config-state-screen";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { configQueryOptions } from "~/infrastructure/api-clients/queries";

export function ConfigPage() {
	const configQuery = createQuery(configQueryOptions);
	const queryClient = useQueryClient();

	return (
		<ConfigStateScreen
			checkAiHealth={() => orpc.ai.health()}
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
