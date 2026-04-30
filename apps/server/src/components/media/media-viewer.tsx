import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import {
	type MediaSource,
	MediaViewer as SharedMediaViewer,
} from "@solid-imager/ui/media-viewer";
import { useParams } from "@tanstack/solid-router";
import { createMemo } from "solid-js";

class HttpMediaSource implements MediaSource {
	type: "image" | "video" | "audio";

	constructor(
		media: MediaDetails,
		private mediaSourceId: string,
		private mediaId: string,
	) {
		this.type =
			media.mediaType === "video"
				? "video"
				: media.mediaType === "audio"
					? "audio"
					: "image";
	}

	getUrl() {
		return `/api/sources/${this.mediaSourceId}/${this.mediaId}`;
	}
}

type MediaViewerProps = {
	media: MediaDetails;
};

export default function MediaViewer(props: MediaViewerProps) {
	const params = useParams({ from: "/sources/$mediaSourceId/$mediaId/" });

	const source = createMemo(
		() =>
			new HttpMediaSource(
				props.media,
				params().mediaSourceId,
				params().mediaId,
			),
	);

	return (
		<SharedMediaViewer
			fileName={props.media.fileName}
			height={props.media.height}
			source={source()}
			width={props.media.width}
		/>
	);
}
