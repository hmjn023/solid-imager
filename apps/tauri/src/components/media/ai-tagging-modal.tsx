import { AiTaggingModal as SharedAiTaggingModal } from "@solid-imager/ui/ai-tagging-modal";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

type AiTaggingModalProps = {
	isOpen: boolean;
	onClose: () => void;
	mediaSourceId: string;
	mediaId: string;
	onSuccess?: () => void;
};

export function AiTaggingModal(props: AiTaggingModalProps) {
	return (
		<SharedAiTaggingModal
			description="Tags extracted from the image using the AI service."
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
