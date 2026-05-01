import { AiTaggingModal as SharedAiTaggingModal } from "@solid-imager/ui/ai-tagging-modal";
import { fetchAiTags } from "~/infrastructure/api-clients/ai-api";

type AiTaggingModalProps = {
	isOpen: boolean;
	onClose: () => void;
	mediaSourceId: string;
	mediaId: string;
};

export default function AiTaggingModal(props: AiTaggingModalProps) {
	return (
		<SharedAiTaggingModal
			fetchTags={() =>
				fetchAiTags({
					mediaSourceId: props.mediaSourceId,
					mediaId: props.mediaId,
				})
			}
			isOpen={props.isOpen}
			onClose={props.onClose}
		/>
	);
}
