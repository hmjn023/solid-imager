import { configQueryKeys, toQueryUiState } from "@solid-imager/ui/query";
import { ConfigStateScreen } from "@solid-imager/ui/screens/config";
import { useQuery, useQueryClient } from "@tanstack/solid-query";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { configQueryOptions } from "~/infrastructure/api-clients/queries";

export function ConfigPage() {
	const configQuery = useQuery(configQueryOptions);
	const queryClient = useQueryClient();
	const state = () => toQueryUiState(configQuery);

	return (
		<ConfigStateScreen
			loadMcpCatalog={() => orpc.config.mcpCatalog()}
			checkAiHealth={() => orpc.ai.health()}
			data={state().data}
			onRetry={async () => {
				await configQuery.refetch();
			}}
			onSubmit={async (value) => {
				const saved = await orpc.config.update(value);
				await queryClient.invalidateQueries({
					queryKey: configQueryKeys.all(),
				});
				return saved;
			}}
			state={state()}
		/>
	);
}
