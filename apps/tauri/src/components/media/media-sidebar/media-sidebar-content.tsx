import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { MediaSidebarContent } from "@solid-imager/ui/media-sidebar-content";
import { activateVectorSearch } from "@solid-imager/ui/stores/search-store";
import { useNavigate } from "@tanstack/solid-router";
import { useBatchJobEvents } from "~/hooks/use-batch-job-events";
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
import { buildMediaContentUrl } from "~/infrastructure/media/thumbnail-runtime";
import { getApiFetch } from "~/infrastructure/tauri-fetch-helpers";
import { client } from "~/orpc-client";
import {
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	projectsForMediaQueryOptions,
} from "~/queries";
import { AiTaggingModal } from "../ai-tagging-modal";
import { CharacterCropModal } from "../character-crop-modal";

type MediaSidebarProps = {
	media: MediaDetails;
	isUpdating?: boolean;
	onUpdate?: () => void;
	sourceRootPath?: string;
};

export function MediaSidebar(props: MediaSidebarProps) {
	const navigate = useNavigate();
	const loadMediaFile = async () => {
		const url = buildMediaContentUrl(props.media.mediaSourceId, props.media.id);
		const response = await getApiFetch()(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch media: ${response.status}`);
		}
		const blob = await response.blob();
		return new File([blob], props.media.fileName);
	};

	return (
		<MediaSidebarContent
			addCharacterToMedia={addCharacterToMedia}
			addIpToMedia={addIpToMedia}
			addProjectToMedia={addProjectToMedia}
			aiTaggingModal={(modalProps) => (
				<AiTaggingModal
					fileName={props.media.fileName}
					isOpen={modalProps.isOpen}
					loadFile={loadMediaFile}
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
			characterCropModal={(modalProps) => (
				<CharacterCropModal
					isOpen={modalProps.isOpen}
					media={props.media}
					onClose={modalProps.onClose}
				/>
			)}
			getCcipVectorStatus={() =>
				client.ai.ccipVectorStatus({
					mediaSourceId: props.media.mediaSourceId,
					mediaId: props.media.id,
				})
			}
			useCcipJobEvents={useBatchJobEvents}
			startCcipExtraction={(force) =>
				client.ai.startCcipExtraction({
					mediaSourceId: props.media.mediaSourceId,
					mediaId: props.media.id,
					force,
				})
			}
			onFindSimilar={() => {
				activateVectorSearch(props.media.id);
				void navigate({ to: "/search" });
			}}
			updateMediaDescription={(mediaSourceId, mediaId, description) =>
				updateMedia(mediaSourceId, mediaId, { description })
			}
		/>
	);
}
