import { useManagerPage } from "@solid-imager/ui/hooks/use-manager-page";
import { RouteDataPendingScreen } from "@solid-imager/ui/router-status";
import { ManagerScreen } from "@solid-imager/ui/screens/manager-screen";
import { useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, onMount, Show } from "solid-js";
import { useBatchJobEvents } from "~/hooks/use-batch-job-events";
import {
	scanBatchCcipTargets,
	scanBatchTaggingTargets,
	startBatchCcipExtraction,
	startBatchTagging,
} from "~/infrastructure/api-clients/ai-api";
import {
	createCharacter,
	deleteCharacter,
	updateCharacter,
} from "~/infrastructure/api-clients/characters-api";
import {
	createIp,
	deleteIp,
	updateIp,
} from "~/infrastructure/api-clients/ips-api";
import {
	bulkDeleteMedia,
	findDuplicateMedia,
} from "~/infrastructure/api-clients/media-api";
import {
	createProject,
	deleteProject,
	updateProject,
} from "~/infrastructure/api-clients/projects-api";
import {
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	mediaSourcesQueryOptions,
} from "~/infrastructure/api-clients/queries";
import type { RouteLoaderContext } from "~/infrastructure/router/route-types";

const managerQueryOptions = {
	projects: allProjectsQueryOptions,
	ips: allIpsQueryOptions,
	characters: allCharactersQueryOptions,
	sources: mediaSourcesQueryOptions,
};

const managerActions = {
	createProject,
	updateProject,
	deleteProject,
	createIp,
	updateIp,
	deleteIp,
	createCharacter,
	updateCharacter,
	deleteCharacter,
	scanBatchTaggingTargets,
	startBatchTagging,
	scanBatchCcipTargets,
	startBatchCcipExtraction,
	findDuplicateMedia,
	bulkDeleteMedia,
};

export const Route = createFileRoute("/manager")({
	ssr: true,
	loader: async ({ context }: RouteLoaderContext) => {
		await Promise.all([
			context.queryClient.prefetchQuery(allProjectsQueryOptions()),
			context.queryClient.prefetchQuery(allIpsQueryOptions()),
			context.queryClient.prefetchQuery(allCharactersQueryOptions()),
			context.queryClient.prefetchQuery(mediaSourcesQueryOptions()),
		]);
	},
	pendingComponent: ManagerRouteFallback,
	pendingMinMs: 0,
	component: ManagerPage,
});

function ManagerRouteFallback() {
	return (
		<RouteDataPendingScreen
			class="p-4 sm:p-8"
			description="管理データを準備しています..."
			layout="manager"
			showAction
			title="Entity Manager"
		/>
	);
}

function ManagerPage() {
	const [isMounted, setIsMounted] = createSignal(false);

	onMount(() => {
		setIsMounted(true);
	});

	return (
		<Show fallback={<ManagerRouteFallback />} when={isMounted()}>
			{(_mounted) => <ManagerPageContent />}
		</Show>
	);
}

function ManagerPageContent() {
	const queryClient = useQueryClient();

	const manager = useManagerPage({
		queryClient,
		queryOptions: managerQueryOptions,
		actions: managerActions,
		useBatchJobEvents,
	});

	return <ManagerScreen manager={manager} />;
}
