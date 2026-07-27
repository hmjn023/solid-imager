import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { CharacterCropModal as SharedCharacterCropModal } from "@solid-imager/ui/character-crop-modal";
import {
	createManualMediaRegion,
	deleteMediaRegion,
	fetchCharacterCrops,
	fetchMediaRegions,
	getMediaRegionRenderUrl,
	materializeMediaRegion,
	updateMediaRegion,
} from "~/infrastructure/api-clients/ai-api";

type CharacterCropModalProps = {
	isOpen: boolean;
	onClose: () => void;
	media: MediaDetails;
};

export default function CharacterCropModal(props: CharacterCropModalProps) {
	return (
		<SharedCharacterCropModal
			createManualRegion={createManualMediaRegion}
			deleteRegion={deleteMediaRegion}
			detectRegions={async (mediaId: string) => {
				const result = await fetchCharacterCrops(mediaId, false);
				if (result.mode !== "media-backed") {
					throw new Error("Character detection did not return saved regions.");
				}
				return result.regions;
			}}
			getRenderUrl={getMediaRegionRenderUrl}
			isOpen={props.isOpen}
			loadRegions={fetchMediaRegions}
			materializeRegion={materializeMediaRegion}
			media={props.media}
			onClose={props.onClose}
			updateRegion={updateMediaRegion}
		/>
	);
}
