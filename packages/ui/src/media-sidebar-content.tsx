import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import type {
	JobCompletedEvent,
	JobFailedEvent,
	JobProgressEvent,
} from "@solid-imager/core/domain/sources/events";
import type {
	CcipVectorStatus,
	StartCcipExtractionResponse,
} from "@solid-imager/core/domain/tagging/schemas";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import type { Accessor, JSX } from "solid-js";
import { MediaSidebar } from "./media-sidebar";
import {
	charactersQueryKeys,
	ipsQueryKeys,
	projectsQueryKeys,
} from "./query-options";

export type MediaSidebarContentProps = {
	media: MediaDetails;
	isUpdating?: boolean;
	onUpdate?: () => void;
	aiTaggingModal: (props: {
		isOpen: boolean;
		onClose: () => void;
	}) => JSX.Element;

	characterCropModal?: (props: {
		isOpen: boolean;
		onClose: () => void;
	}) => JSX.Element;
	oppaiOracleModal?: (props: {
		isOpen: boolean;
		onClose: () => void;
	}) => JSX.Element;
	getCcipVectorStatus?: () => Promise<CcipVectorStatus>;
	startCcipExtraction?: (
		force: boolean,
	) => Promise<StartCcipExtractionResponse>;
	useCcipJobEvents?: (
		activeJobId: Accessor<string | null>,
		handlers: {
			handleJobProgress: (event: JobProgressEvent) => void;
			handleJobCompleted: (event: JobCompletedEvent) => void;
			handleJobFailed: (event: JobFailedEvent) => void;
		},
	) => void;
	onFindSimilar?: () => void;
	// biome-ignore lint/suspicious/noExplicitAny: library type mismatch between oRPC and solid-query
	projectsForMediaQueryOptions: (mediaSourceId: string, mediaId: string) => any;
	// biome-ignore lint/suspicious/noExplicitAny: library type mismatch between oRPC and solid-query
	allProjectsQueryOptions: () => any;
	// biome-ignore lint/suspicious/noExplicitAny: library type mismatch between oRPC and solid-query
	allIpsQueryOptions: () => any;
	// biome-ignore lint/suspicious/noExplicitAny: library type mismatch between oRPC and solid-query
	allCharactersQueryOptions: () => any;
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

	const projects = createQuery<Project[]>(() =>
		props.projectsForMediaQueryOptions(
			props.media.mediaSourceId,
			props.media.id,
		),
	);
	const allProjects = createQuery<Project[]>(() =>
		props.allProjectsQueryOptions(),
	);
	const allIps = createQuery<Ip[]>(() => props.allIpsQueryOptions());
	const allCharacters = createQuery<Character[]>(() =>
		props.allCharactersQueryOptions(),
	);

	const invalidateProjectsForMedia = () =>
		queryClient.invalidateQueries({
			queryKey: projectsQueryKeys.forMedia(props.media.id),
		});

	return (
		<MediaSidebar
			aiTaggingModal={props.aiTaggingModal}
			characterCropModal={props.characterCropModal}
			oppaiOracleModal={props.oppaiOracleModal}
			getCcipVectorStatus={props.getCcipVectorStatus}
			startCcipExtraction={props.startCcipExtraction}
			useCcipJobEvents={props.useCcipJobEvents}
			onFindSimilar={props.onFindSimilar}
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
			}}
			onUpdate={props.onUpdate}
			projects={projects.data || []}
		/>
	);
}
