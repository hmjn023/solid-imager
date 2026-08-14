import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { CharacterCropModal as SharedCharacterCropModal } from "@solid-imager/ui/character-crop-modal";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

type CharacterCropModalProps = {
	isOpen: boolean;
	onClose: () => void;
	media: MediaDetails;
};

export function CharacterCropModal(props: CharacterCropModalProps) {
	return (
		<SharedCharacterCropModal
			fetchCrops={async (mediaId: string, transparent: boolean) => {
				return orpc.ai.detectAndCropCharacters({
					mediaId,
					transparent,
				});
			}}
			isOpen={props.isOpen}
			media={props.media}
			onClose={props.onClose}
		/>
	);
}
