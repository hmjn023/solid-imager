import { SourceMediaScreen } from "@solid-imager/ui/screens/source-media-screen";
import type { Accessor } from "solid-js";
import { UploadMediaModal } from "~/components/upload-media-modal";
import { SourceMediaPageController } from "./source-media-page";

export function SourceMediaPage(
	props: { mediaSourceId?: Accessor<string> } = {},
) {
	return (
		<SourceMediaPageController
			mediaSourceId={props.mediaSourceId}
			persistenceSurface="legacy"
			routeVersion="default"
			screenComponent={SourceMediaScreen}
			uploadModalComponent={UploadMediaModal}
		/>
	);
}
