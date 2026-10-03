import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { MediaActions as SharedMediaActions } from "@solid-imager/ui/media-actions";
import { OppaiOracleModal } from "@solid-imager/ui/oppai-oracle-modal";
import { activateSimilaritySearch } from "@solid-imager/ui/stores/search-store";
import { useNavigate } from "@tanstack/solid-router";
import { AiTaggingModal } from "~/components/media/ai-tagging-modal";
import { CharacterCropModal } from "~/components/media/character-crop-modal";
import { useBatchJobEvents } from "~/hooks/use-batch-job-events";
import { deleteMedia } from "~/infrastructure/api-clients/media-api";
import { buildMediaContentUrl } from "~/infrastructure/media/thumbnail-runtime";
import { getApiFetch } from "~/infrastructure/tauri-fetch-helpers";
import { client } from "~/orpc-client";

export type MediaActionsProps = {
	media: MediaDetails;
	onUpdate?: () => void;
};

async function downloadMedia(media: MediaDetails): Promise<void> {
	const response = await getApiFetch()(
		buildMediaContentUrl(media.mediaSourceId, media.id),
	);
	if (!response.ok) {
		throw new Error(`Failed to fetch media: ${response.status}`);
	}
	const blob = await response.blob();
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = media.fileName;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

export function MediaActions(props: MediaActionsProps) {
	const navigate = useNavigate();

	return (
		<SharedMediaActions
			aiTaggingModal={(modalProps) => (
				<AiTaggingModal
					isOpen={modalProps.isOpen}
					mediaId={props.media.id}
					mediaSourceId={props.media.mediaSourceId}
					onClose={modalProps.onClose}
					onSuccess={props.onUpdate}
				/>
			)}
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
			onDelete={async () => {
				await deleteMedia(props.media.mediaSourceId, props.media.id);
				await navigate({
					params: { mediaSourceId: props.media.mediaSourceId },
					replace: true,
					to: "/sources/$mediaSourceId",
				});
			}}
			onDownload={() => downloadMedia(props.media)}
			onFindSimilar={() => {
				activateSimilaritySearch(props.media.id);
				void navigate({ to: "/search" });
			}}
			onUpdate={props.onUpdate}
			oppaiOracleModal={(modalProps) => (
				<OppaiOracleModal
					description="Tags extracted from the image using the OppaiOracle model."
					fetchTags={() =>
						client.ai.tagOppaiOracle({
							mediaSourceId: props.media.mediaSourceId,
							mediaId: props.media.id,
						})
					}
					isOpen={modalProps.isOpen}
					onClose={modalProps.onClose}
					onSuccess={props.onUpdate}
				/>
			)}
			startCcipExtraction={(force) =>
				client.ai.startCcipExtraction({
					mediaSourceId: props.media.mediaSourceId,
					mediaId: props.media.id,
					force,
				})
			}
			useCcipJobEvents={useBatchJobEvents}
			media={props.media}
		/>
	);
}
