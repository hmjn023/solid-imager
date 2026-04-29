import type { Media } from "@solid-imager/core/domain/media/schemas";
import { useManagerPage } from "@solid-imager/ui/hooks/use-manager-page";
import { ManagerScreen } from "@solid-imager/ui/screens/manager-screen";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { MediaCardItem } from "~/components/media/media-card-item";
import { useBatchJobEvents } from "~/hooks/use-batch-job-events";
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
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import {
	createProject,
	deleteProject,
	updateProject,
} from "~/infrastructure/api-clients/projects-api";
import { allCharactersQueryOptions } from "~/infrastructure/api-clients/queries/characters-query";
import { allIpsQueryOptions } from "~/infrastructure/api-clients/queries/ips-query";
import { allProjectsQueryOptions } from "~/infrastructure/api-clients/queries/projects-query";
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries/sources-query";

export const Route = createFileRoute("/manager")({
	ssr: true,
	beforeLoad: ({ context }) => {
		void context;
	},
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(allProjectsQueryOptions()),
			context.queryClient.ensureQueryData(allIpsQueryOptions()),
			context.queryClient.ensureQueryData(allCharactersQueryOptions()),
			context.queryClient.ensureQueryData(mediaSourcesQueryOptions()),
		]);
	},
	component: ManagerPage,
});

export default function ManagerPage() {
	const queryClient = useQueryClient();
	const projects = createQuery(() => allProjectsQueryOptions());
	const ips = createQuery(() => allIpsQueryOptions());
	const characters = createQuery(() => allCharactersQueryOptions());
	const sources = createQuery(() => mediaSourcesQueryOptions());

	const manager = useManagerPage({
		queries: {
			projects: () => projects.data,
			ips: () => ips.data,
			characters: () => characters.data,
			sources: () => sources.data,
		},
		actions: {
			createProject,
			updateProject,
			deleteProject,
			createIp,
			updateIp,
			deleteIp,
			createCharacter,
			updateCharacter,
			deleteCharacter,
			scanBatchTaggingTargets: orpc.ai.scanBatchTaggingTargets,
			startBatchTaggingWithIds: orpc.ai.startBatchTaggingWithIds,
			invalidate: (entityType) => {
				if (entityType === "projects") {
					void queryClient.invalidateQueries({ queryKey: ["allProjects"] });
				} else if (entityType === "ips") {
					void queryClient.invalidateQueries({ queryKey: ["allIps"] });
				} else if (entityType === "characters") {
					void queryClient.invalidateQueries({ queryKey: ["allCharacters"] });
				}
			},
		},
	});

	useBatchJobEvents(manager.activeJobId, manager.jobHandlers);

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
