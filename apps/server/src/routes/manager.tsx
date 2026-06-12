import type { Media } from "@solid-imager/core/domain/media/schemas";
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
	deleteMedia,
	findDuplicateMedia,
} from "~/infrastructure/api-clients/media-api";
import {
	createProject,
	deleteProject,
	updateProject,
} from "~/infrastructure/api-clients/projects-api";
import { allCharactersQueryOptions } from "~/infrastructure/api-clients/queries/characters-query";
import { allIpsQueryOptions } from "~/infrastructure/api-clients/queries/ips-query";
import { allProjectsQueryOptions } from "~/infrastructure/api-clients/queries/projects-query";
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries/sources-query";

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
	findDuplicateMedia,
	deleteMedia,
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
				media: Media,
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
