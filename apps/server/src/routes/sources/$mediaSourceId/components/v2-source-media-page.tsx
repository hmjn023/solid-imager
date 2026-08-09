import { V2SourceMediaScreen } from "@solid-imager/ui/screens/v2-source-media-screen";
import { useLocation, useNavigate } from "@tanstack/solid-router";
import type { Accessor } from "solid-js";
import { ThumbnailImage } from "~/components/media/thumbnail-image";
import { V2UploadMediaModal } from "~/components/upload-media-modal";
import {
	SourceMediaPageController,
	type SourceMediaPageControllerProps,
} from "./source-media-page";

export function V2SourceMediaPage(props: { mediaSourceId?: Accessor<string> }) {
	const location = useLocation();
	const navigate = useNavigate();

	const onOpenMediaDetail: SourceMediaPageControllerProps["onOpenMediaDetail"] =
		(media) => {
			sessionStorage.setItem("v2:media-return", location().href);
			void navigate({
				params: {
					mediaId: media.id,
					mediaSourceId: media.mediaSourceId,
				},
				to: "/v2/sources/$mediaSourceId/$mediaId",
			});
		};

	return (
		<SourceMediaPageController
			mediaSourceId={props.mediaSourceId}
			onOpenMediaDetail={onOpenMediaDetail}
			persistenceSurface="v2"
			renderMediaPreview={(media) => (
				<ThumbnailImage
					alt={media.fileName}
					class="h-full w-full object-contain"
					height={media.height}
					loading="eager"
					media={media}
					requestedSize={512}
					width={media.width}
				/>
			)}
			routeVersion="v2"
			screenComponent={V2SourceMediaScreen}
			uploadModalComponent={V2UploadMediaModal}
		/>
	);
}
