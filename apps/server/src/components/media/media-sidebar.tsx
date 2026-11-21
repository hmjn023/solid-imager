import type { MediaDetails } from "@solid-imager/core/media";
import { MediaSidebarContent } from "@solid-imager/ui/media-sidebar-content";
import { activateTagSearch } from "@solid-imager/ui/search/state";
import { useRouter } from "@tanstack/solid-router";
import type { Accessor } from "solid-js";
import {
	addCharacterToMedia,
	createCharacter,
	removeCharacterFromMedia,
} from "~/infrastructure/api-clients/characters-api";
import {
	addIpToMedia,
	createIp,
	removeIpFromMedia,
} from "~/infrastructure/api-clients/ips-api";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { updateMedia } from "~/infrastructure/api-clients/media-api";
import {
	addProjectToMedia,
	createProject,
	removeProjectFromMedia,
} from "~/infrastructure/api-clients/projects-api";
import {
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	projectsForMediaQueryOptions,
} from "~/infrastructure/api-clients/queries";

export type MediaSidebarProps = {
	media: MediaDetails;
	isUpdating?: Accessor<boolean>;
	onSearchTag?: (tagName: string) => void;
	onUpdate?: () => void;
};

export function MediaSidebar(props: MediaSidebarProps) {
	const router = useRouter();

	return (
		<MediaSidebarContent
			activityApi={orpc.media}
			tagDictionaryLookup={orpc.tags}
			updatePositiveTags={orpc.media.updatePositiveTags}
			addCharacterToMedia={addCharacterToMedia}
			addIpToMedia={addIpToMedia}
			addProjectToMedia={addProjectToMedia}
			allCharactersQueryOptions={allCharactersQueryOptions}
			allIpsQueryOptions={allIpsQueryOptions}
			allProjectsQueryOptions={allProjectsQueryOptions}
			createCharacter={createCharacter}
			createIp={createIp}
			createProject={createProject}
			isUpdating={props.isUpdating}
			media={props.media}
			onSearchTag={
				props.onSearchTag ??
				((tagName) => {
					activateTagSearch(tagName);
					void router.navigate({ to: "/search" });
				})
			}
			onUpdate={props.onUpdate}
			projectsForMediaQueryOptions={projectsForMediaQueryOptions}
			removeCharacterFromMedia={removeCharacterFromMedia}
			removeIpFromMedia={removeIpFromMedia}
			removeProjectFromMedia={removeProjectFromMedia}
			updateMediaDescription={(mediaSourceId, mediaId, description) =>
				updateMedia(mediaSourceId, mediaId, { description })
			}
		/>
	);
}
