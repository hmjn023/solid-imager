import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { useParams } from "@tanstack/solid-router";
import { createMemo } from "solid-js";
import { MediaViewer as SharedMediaViewer, type MediaSource } from "@solid-imager/ui/media-viewer";

class HttpMediaSource implements MediaSource {
	type: "image" | "video" | "audio";

	constructor(
		private media: MediaDetails,
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

	async getMetadata() {
		return {
			width: this.media.width,
			height: this.media.height,
		};
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
