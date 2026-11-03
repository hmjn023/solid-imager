import { configQueryKeys, toQueryUiState } from "@solid-imager/ui/query";
import { ConfigStateScreen } from "@solid-imager/ui/screens/config";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { configQueryOptions } from "~/queries";

export const Route = createFileRoute("/config")({
	loader: ({ context }) => {
		void context.queryClient.query(configQueryOptions()).then(
			() => undefined,
			() => undefined,
		);
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
			loadMcpCatalog={() => orpc.config.mcpCatalog()}
			checkAiHealth={() => orpc.ai.health()}
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
