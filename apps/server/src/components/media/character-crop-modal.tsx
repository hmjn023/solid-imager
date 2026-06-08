import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { CharacterCropModal as SharedCharacterCropModal } from "@solid-imager/ui/character-crop-modal";
import { fetchCharacterCrops } from "~/infrastructure/api-clients/ai-api";

type CharacterCropModalProps = {
	isOpen: boolean;
	onClose: () => void;
	media: MediaDetails;
};

export default function CharacterCropModal(props: CharacterCropModalProps) {
	return (
		<SharedCharacterCropModal
			fetchCrops={async (mediaId: string, transparent: boolean) =>
				fetchCharacterCrops(mediaId, transparent)
			}
			isOpen={props.isOpen}
			media={props.media}
			onClose={props.onClose}
		/>
	);
}
