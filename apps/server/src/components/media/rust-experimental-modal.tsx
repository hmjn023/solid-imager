import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { RustExperimentalModal as SharedRustExperimentalModal } from "@solid-imager/ui/rust-experimental-modal";
import { fetchRustExperimentalTags } from "~/infrastructure/api-clients/ai-api";

type RustExperimentalModalProps = {
	isOpen: boolean;
	onClose: () => void;
	media: MediaDetails;
};

export default function RustExperimentalModal(
	props: RustExperimentalModalProps,
) {
	return (
		<SharedRustExperimentalModal
			fetchTags={async (mediaId: string) => {
				return fetchRustExperimentalTags(mediaId);
			}}
			isOpen={props.isOpen}
			media={props.media}
			onClose={props.onClose}
		/>
	);
}
