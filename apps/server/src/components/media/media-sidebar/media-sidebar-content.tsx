import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { MediaSidebar as SharedMediaSidebar } from "@solid-imager/ui/media-sidebar";
import { projectsQueryKeys } from "@solid-imager/ui/query-options";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import AiTaggingModal from "~/components/media/ai-tagging-modal";
import {
	addCharacterToMedia,
	createCharacter,
	fetchAllCharacters,
	removeCharacterFromMedia,
} from "~/infrastructure/api-clients/characters-api";
import {
	addIpToMedia,
	createIp,
	fetchAllIps,
	removeIpFromMedia,
} from "~/infrastructure/api-clients/ips-api";
import { updateMedia } from "~/infrastructure/api-clients/media-api";
import {
	addProjectToMedia,
	createProject,
	fetchAllProjects,
	removeProjectFromMedia,
} from "~/infrastructure/api-clients/projects-api";
import { projectsForMediaQueryOptions } from "~/infrastructure/api-clients/queries/projects-query";

type MediaSidebarProps = {
	media: MediaDetails;
	isUpdating?: boolean;
	onUpdate?: () => void;
};

export default function MediaSidebar(props: MediaSidebarProps) {
	const queryClient = useQueryClient();
	const projects = createQuery(() =>
		projectsForMediaQueryOptions(props.media.mediaSourceId, props.media.id),
	);
	const allProjects = createQuery(() => ({
		queryKey: ["allProjects"],
		queryFn: fetchAllProjects,
	}));
	const allIps = createQuery(() => ({
		queryKey: ["allIps"],
		queryFn: fetchAllIps,
	}));
	const allCharacters = createQuery(() => ({
		queryKey: ["allCharacters"],
		queryFn: fetchAllCharacters,
	}));

	const invalidateProjectsForMedia = () =>
		queryClient.invalidateQueries({
			queryKey: projectsQueryKeys.forMedia(props.media.id),
		});

	return (
		<SharedMediaSidebar
			aiTaggingModal={(modalProps) => (
				<AiTaggingModal
					isOpen={modalProps.isOpen}
					mediaId={props.media.id}
					mediaSourceId={props.media.mediaSourceId}
					onClose={modalProps.onClose}
				/>
			)}
			allCharacters={allCharacters.data || []}
			allIps={allIps.data || []}
			allProjects={allProjects.data || []}
			isAllCharactersLoading={allCharacters.isLoading}
			isAllIpsLoading={allIps.isLoading}
			isProjectsLoading={projects.isLoading}
			isUpdating={props.isUpdating}
			media={props.media}
			onCharacterAdd={async (characterId) => {
				await addCharacterToMedia(
					props.media.mediaSourceId,
					props.media.id,
					characterId,
				);
			}}
			onCharacterCreate={async (name) => {
				const character = await createCharacter({ name });
				await queryClient.invalidateQueries({ queryKey: ["allCharacters"] });
				return character;
			}}
			onCharacterRemove={async (characterId) => {
				await removeCharacterFromMedia(
					props.media.mediaSourceId,
					props.media.id,
					characterId,
				);
				props.onUpdate?.();
			}}
			onDescriptionUpdate={async (description) => {
				await updateMedia(props.media.mediaSourceId, props.media.id, {
					description,
				});
			}}
			onIpAdd={async (ipId) => {
				await addIpToMedia(props.media.mediaSourceId, props.media.id, ipId);
				props.onUpdate?.();
			}}
			onIpCreate={async (name) => {
				const ip = await createIp({ name });
				await queryClient.invalidateQueries({ queryKey: ["allIps"] });
				return ip;
			}}
			onIpRemove={async (ipId) => {
				await removeIpFromMedia(
					props.media.mediaSourceId,
					props.media.id,
					ipId,
				);
				props.onUpdate?.();
			}}
			onProjectAdd={async (projectId) => {
				await addProjectToMedia(
					props.media.mediaSourceId,
					props.media.id,
					projectId,
				);
				await invalidateProjectsForMedia();
			}}
			onProjectCreate={async (name) => {
				const project = await createProject({ name });
				await queryClient.invalidateQueries({ queryKey: ["allProjects"] });
				return project;
			}}
			onProjectRemove={async (projectId) => {
				await removeProjectFromMedia(
					props.media.mediaSourceId,
					props.media.id,
					projectId,
				);
				await invalidateProjectsForMedia();
			}}
			onUpdate={props.onUpdate}
			projects={projects.data || []}
		/>
	);
}
