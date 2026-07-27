import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import type { SafeMediaRegion } from "@solid-imager/core/domain/media-regions/schemas";
import { CharacterCropModal as SharedCharacterCropModal } from "@solid-imager/ui/character-crop-modal";
import {
	serverApiBaseUrl,
	serverOrpc,
} from "~/infrastructure/api-clients/server-orpc-client";

function getRenderUrl(region: SafeMediaRegion, transparent: boolean): string {
	const query = new URLSearchParams({
		revision: region.regionRevision,
		transparent: String(transparent),
	});
	return `${serverApiBaseUrl}/api/media-regions/${encodeURIComponent(region.id)}/render?${query}`;
}

type CharacterCropModalProps = {
	isOpen: boolean;
	onClose: () => void;
	media: MediaDetails;
};

export function CharacterCropModal(props: CharacterCropModalProps) {
	return (
		<SharedCharacterCropModal
			createManualRegion={(input) =>
				serverOrpc.mediaRegions.createManual(input)
			}
			deleteRegion={async (regionId, expectedRevision) => {
				await serverOrpc.mediaRegions.delete({ regionId, expectedRevision });
			}}
			detectRegions={async (mediaId: string) => {
				const result = await serverOrpc.ai.detectAndCropCharacters({
					mediaId,
					transparent: false,
				});
				if (result.mode !== "media-backed") {
					throw new Error("Character detection did not return saved regions.");
				}
				return result.regions;
			}}
			getRenderUrl={getRenderUrl}
			isOpen={props.isOpen}
			loadRegions={(mediaId) => serverOrpc.mediaRegions.list({ mediaId })}
			materializeRegion={(regionId, expectedRevision, transparent) =>
				serverOrpc.mediaRegions.materialize({
					regionId,
					expectedRevision,
					profile: { transparent },
				})
			}
			media={props.media}
			onClose={props.onClose}
			updateRegion={(input) => serverOrpc.mediaRegions.update(input)}
		/>
	);
}
