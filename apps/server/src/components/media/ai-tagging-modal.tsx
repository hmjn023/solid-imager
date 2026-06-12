import { AiTaggingModal as SharedAiTaggingModal } from "@solid-imager/ui/ai-tagging-modal";
import { fetchAiTags } from "~/infrastructure/api-clients/ai-api";

type AiTaggingModalProps = {
	isOpen: boolean;
	onClose: () => void;
	mediaSourceId: string;
	mediaId: string;
};

export function AiTaggingModal(props: AiTaggingModalProps) {
	return (
		<SharedAiTaggingModal
			description={`Tags extracted from the image using the AI service.`}
			fetchTags={async () => {
				const result = await fetchAiTags({
					mediaSourceId: props.mediaSourceId,
					mediaId: props.mediaId,
				});
				if (!result) {
					throw new Error("No tagging result returned");
				}
				return result;
			}}
			isOpen={props.isOpen}
			onClose={props.onClose}
		/>
	);
}
