import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { RustExperimentalModal as SharedRustExperimentalModal } from "@solid-imager/ui/rust-experimental-modal";
import { serverOrpc } from "~/infrastructure/api-clients/server-orpc-client";

type RustExperimentalModalProps = {
	isOpen: boolean;
	onClose: () => void;
	media: MediaDetails;
};

export function RustExperimentalModal(props: RustExperimentalModalProps) {
	return (
		<SharedRustExperimentalModal
			fetchTags={async (mediaId: string) => {
				return serverOrpc.ai.tagRustExperimental({
					mediaId,
				}) as any;
			}}
			isOpen={props.isOpen}
			media={props.media}
			onClose={props.onClose}
		/>
	);
}
