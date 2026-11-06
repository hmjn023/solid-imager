import type { Media } from "@solid-imager/core/media";
import { AiTaggingModal as SharedAiTaggingModal } from "@solid-imager/ui/ai-tagging-modal";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

type AiTaggingModalProps = {
	isOpen: boolean;
	onClose: () => void;
	mediaSourceId: string;
	mediaId: string;
	mediaType?: Media["mediaType"];
	onSuccess?: () => void;
};

export function AiTaggingModal(props: AiTaggingModalProps) {
	return (
		<SharedAiTaggingModal
			mediaType={props.mediaType}
			fetchTags={() =>
				orpc.ai.tag({
					mediaSourceId: props.mediaSourceId,
					mediaId: props.mediaId,
				})
			}
			isOpen={props.isOpen}
			onClose={props.onClose}
			onSuccess={props.onSuccess}
		/>
	);
}
