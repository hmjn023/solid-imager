import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { MediaSidebarContent } from "@solid-imager/ui/media-sidebar-content";
import AiTaggingModal from "~/components/media/ai-tagging-modal";
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
import { allCharactersQueryOptions } from "~/infrastructure/api-clients/queries/characters-query";
import { allIpsQueryOptions } from "~/infrastructure/api-clients/queries/ips-query";
import {
	allProjectsQueryOptions,
	projectsForMediaQueryOptions,
} from "~/infrastructure/api-clients/queries/projects-query";

type MediaSidebarProps = {
	media: MediaDetails;
	isUpdating?: boolean;
	onUpdate?: () => void;
};

export default function MediaSidebar(props: MediaSidebarProps) {
	return (
		<MediaSidebarContent
			addCharacterToMedia={addCharacterToMedia}
			addIpToMedia={addIpToMedia}
			addProjectToMedia={addProjectToMedia}
			aiTaggingModal={(modalProps) => (
				<AiTaggingModal
					isOpen={modalProps.isOpen}
					mediaId={props.media.id}
					mediaSourceId={props.media.mediaSourceId}
					onClose={modalProps.onClose}
				/>
			)}
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
