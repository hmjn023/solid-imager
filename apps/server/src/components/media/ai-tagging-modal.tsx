import type { Media } from "@solid-imager/core/media";
import { AiTaggingModal as SharedAiTaggingModal } from "@solid-imager/ui/ai-tagging-modal";
import { fetchAiTags } from "~/infrastructure/api-clients/ai-api";

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
			onSuccess={props.onSuccess}
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
