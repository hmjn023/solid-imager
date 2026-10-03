import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { MediaSidebarContent } from "@solid-imager/ui/media-sidebar-content";
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
} from "~/queries";

export type MediaSidebarProps = {
	media: MediaDetails;
	isUpdating?: Accessor<boolean>;
	onUpdate?: () => void;
};

export function MediaSidebar(props: MediaSidebarProps) {
	return (
		<MediaSidebarContent
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
