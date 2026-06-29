import type { MediaSafe } from "@solid-imager/core/domain/media/schemas";
import {
	prefetchManagerPageQueries,
	useManagerPage,
} from "@solid-imager/ui/hooks/use-manager-page";
import { ManagerScreen } from "@solid-imager/ui/screens/manager-screen";
import { useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { MediaCardItem } from "~/components/media/media-card-item";
import { useBatchJobEvents } from "~/hooks/use-batch-job-events";
import {
	scanBatchTaggingTargets,
	startBatchTaggingWithIds,
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
import { client } from "~/orpc-client";
import {
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	mediaSourcesQueryOptions,
} from "~/queries";

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
	startBatchTaggingWithIds,
	scanBatchCcipTargets: (input: { force: boolean; mediaSourceId?: string }) =>
		client.ai.scanBatchCcipTargets(input),
	startBatchCcipExtraction: (input: {
		force: boolean;
		mediaSourceId?: string;
		mediaIds: string[];
	}) => client.ai.startBatchCcipExtraction(input),
	findDuplicateMedia,
	bulkDeleteMedia,
};

export const Route = createFileRoute("/manager")({
	loader: async ({ context }) => {
		await prefetchManagerPageQueries(context.queryClient, managerQueryOptions);
	},
	component: ManagerPage,
});

function ManagerPage() {
	const queryClient = useQueryClient();

	const manager = useManagerPage({
		queryClient,
		queryOptions: managerQueryOptions,
		actions: managerActions,
		useBatchJobEvents,
	});

	return (
		<ManagerScreen
			manager={manager}
			renderMediaCard={(
				media: MediaSafe,
				selected: boolean,
				onToggle: (mediaId: string) => void,
			) => (
				<MediaCardItem
					media={media}
					onToggle={onToggle}
					selectable
					selected={selected}
				/>
			)}
		/>
	);
}
