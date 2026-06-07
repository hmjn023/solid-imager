import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { CharacterCropModal as SharedCharacterCropModal } from "@solid-imager/ui/character-crop-modal";
import { serverOrpc } from "~/infrastructure/api-clients/server-orpc-client";

type CharacterCropModalProps = {
	isOpen: boolean;
	onClose: () => void;
	media: MediaDetails;
};

export function CharacterCropModal(props: CharacterCropModalProps) {
	return (
		<SharedCharacterCropModal
			fetchCrops={async (mediaId: string) => {
				return serverOrpc.ai.detectAndCropCharacters({
					mediaId,
				}) as any;
			}}
			isOpen={props.isOpen}
			media={props.media}
			onClose={props.onClose}
		/>
	);
}
