import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import {
	createQuery,
	type QueryFunctionContext,
	useQueryClient,
} from "@tanstack/solid-query";
import type { Accessor } from "solid-js";
import { MediaSidebar } from "./media-sidebar";
import {
	charactersQueryKeys,
	ipsQueryKeys,
	projectsQueryKeys,
} from "./query-options";

type QueryOptions<TData> = {
	queryKey: readonly unknown[];
	queryFn: (context: QueryFunctionContext) => Promise<TData>;
};
type QueryOptionsFactory<TData> = () => QueryOptions<TData>;

export type MediaSidebarContentProps = {
	media: MediaDetails;
	isUpdating?: Accessor<boolean>;
	onUpdate?: () => void;
	projectsForMediaQueryOptions: (
		mediaSourceId: string,
		mediaId: string,
	) => QueryOptions<Project[]>;
	allProjectsQueryOptions: QueryOptionsFactory<Project[]>;
	allIpsQueryOptions: QueryOptionsFactory<Ip[]>;
	allCharactersQueryOptions: QueryOptionsFactory<Character[]>;
	addProjectToMedia: (
		mediaSourceId: string,
		mediaId: string,
		projectId: string,
	) => Promise<unknown>;
	removeProjectFromMedia: (
		mediaSourceId: string,
		mediaId: string,
		projectId: string,
	) => Promise<unknown>;
	createProject: (data: { name: string }) => Promise<{ id: string }>;
	addIpToMedia: (
		mediaSourceId: string,
		mediaId: string,
		ipId: string,
	) => Promise<unknown>;
	removeIpFromMedia: (
		mediaSourceId: string,
		mediaId: string,
		ipId: string,
	) => Promise<unknown>;
	createIp: (data: { name: string }) => Promise<{ id: string }>;
	addCharacterToMedia: (
		mediaSourceId: string,
		mediaId: string,
		characterId: string,
	) => Promise<unknown>;
	removeCharacterFromMedia: (
		mediaSourceId: string,
		mediaId: string,
		characterId: string,
	) => Promise<unknown>;
	createCharacter: (data: { name: string }) => Promise<{ id: string }>;
	updateMediaDescription: (
		mediaSourceId: string,
		mediaId: string,
		description: string,
	) => Promise<unknown>;
};

export function MediaSidebarContent(props: MediaSidebarContentProps) {
	const queryClient = useQueryClient();

	const projects = createQuery<Project[]>(() => {
		const options = props.projectsForMediaQueryOptions(
			props.media.mediaSourceId,
			props.media.id,
		);
		return options;
	});
	const allProjects = createQuery<Project[]>(() => {
		const options = props.allProjectsQueryOptions();
		return options;
	});
	const allIps = createQuery<Ip[]>(() => {
		const options = props.allIpsQueryOptions();
		return options;
	});
	const allCharacters = createQuery<Character[]>(() => {
		const options = props.allCharactersQueryOptions();
		return options;
	});

	const invalidateProjectsForMedia = () =>
		queryClient.invalidateQueries({
			queryKey: projectsQueryKeys.forMedia(props.media.id),
		});

	return (
		<MediaSidebar
			allCharacters={allCharacters.data || []}
			allIps={allIps.data || []}
			allProjects={allProjects.data || []}
			isAllCharactersLoading={allCharacters.isLoading}
			isAllIpsLoading={allIps.isLoading}
			isProjectsLoading={projects.isLoading}
			isUpdating={props.isUpdating}
			media={props.media}
			onCharacterAdd={async (characterId) => {
				await props.addCharacterToMedia(
					props.media.mediaSourceId,
					props.media.id,
					characterId,
				);
			}}
			onCharacterCreate={async (name) => {
				const character = await props.createCharacter({ name });
				await queryClient.invalidateQueries({
					queryKey: charactersQueryKeys.all(),
				});
				return character;
			}}
			onCharacterRemove={async (characterId) => {
				await props.removeCharacterFromMedia(
					props.media.mediaSourceId,
					props.media.id,
					characterId,
				);
				props.onUpdate?.();
			}}
			onDescriptionUpdate={async (description) => {
				await props.updateMediaDescription(
					props.media.mediaSourceId,
					props.media.id,
					description,
				);
			}}
			onIpAdd={async (ipId) => {
				await props.addIpToMedia(
					props.media.mediaSourceId,
					props.media.id,
					ipId,
				);
				props.onUpdate?.();
			}}
			onIpCreate={async (name) => {
				const ip = await props.createIp({ name });
				await queryClient.invalidateQueries({ queryKey: ipsQueryKeys.all() });
				return ip;
			}}
			onIpRemove={async (ipId) => {
				await props.removeIpFromMedia(
					props.media.mediaSourceId,
					props.media.id,
					ipId,
				);
				props.onUpdate?.();
			}}
			onProjectAdd={async (projectId) => {
				await props.addProjectToMedia(
					props.media.mediaSourceId,
					props.media.id,
					projectId,
				);
				await invalidateProjectsForMedia();
				props.onUpdate?.();
			}}
			onProjectCreate={async (name) => {
				const project = await props.createProject({ name });
				await queryClient.invalidateQueries({
					queryKey: projectsQueryKeys.all(),
				});
				return project;
			}}
			onProjectRemove={async (projectId) => {
				await props.removeProjectFromMedia(
					props.media.mediaSourceId,
					props.media.id,
					projectId,
				);
				await invalidateProjectsForMedia();
				props.onUpdate?.();
			}}
			onUpdate={props.onUpdate}
			projects={projects.data || []}
		/>
	);
}
