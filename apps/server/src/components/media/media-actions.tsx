import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { MediaActions as SharedMediaActions } from "@solid-imager/ui/media-actions";
import { activateSimilaritySearch } from "@solid-imager/ui/stores/search-store";
import { useNavigate } from "@tanstack/solid-router";
import { AiTaggingModal } from "~/components/media/ai-tagging-modal";
import CharacterCropModal from "~/components/media/character-crop-modal";
import { OppaiOracleModal } from "~/components/media/oppai-oracle-modal";
import { useBatchJobEvents } from "~/hooks/use-batch-job-events";
import {
	getCcipVectorStatus,
	startCcipExtraction,
} from "~/infrastructure/api-clients/ai-api";
import { deleteMedia } from "~/infrastructure/api-clients/media-api";

export type MediaActionsProps = {
	media: MediaDetails;
	onUpdate?: () => void;
};

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
				getCcipVectorStatus(props.media.mediaSourceId, props.media.id)
			}
			onDelete={async () => {
				await deleteMedia(props.media.mediaSourceId, props.media.id);
				await navigate({
					params: { mediaSourceId: props.media.mediaSourceId },
					replace: true,
					to: "/sources/$mediaSourceId",
				});
			}}
			onDownload={() => {
				const anchor = document.createElement("a");
				anchor.href = `/api/sources/${encodeURIComponent(props.media.mediaSourceId)}/${encodeURIComponent(props.media.id)}`;
				anchor.download = props.media.fileName;
				anchor.click();
			}}
			onFindSimilar={() => {
				activateSimilaritySearch(props.media.id);
				void navigate({ to: "/search" });
			}}
			onUpdate={props.onUpdate}
			oppaiOracleModal={(modalProps) => (
				<OppaiOracleModal
					isOpen={modalProps.isOpen}
					mediaId={props.media.id}
					mediaSourceId={props.media.mediaSourceId}
					onClose={modalProps.onClose}
					onSuccess={props.onUpdate}
				/>
			)}
			startCcipExtraction={(force) =>
				startCcipExtraction(props.media.mediaSourceId, props.media.id, force)
			}
			useCcipJobEvents={useBatchJobEvents}
			media={props.media}
		/>
	);
}
