import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import {
	type MediaSource,
	MediaViewer as SharedMediaViewer,
} from "@solid-imager/ui/media-viewer";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { createMemo } from "solid-js";
import { buildMediaContentUrl } from "~/infrastructure/media/thumbnail-runtime";

const MIME_BY_EXTENSION: Record<string, string> = {
	mp4: "video/mp4",
	webm: "video/webm",
	mov: "video/quicktime",
	mp3: "audio/mpeg",
	wav: "audio/wav",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
	gif: "image/gif",
	bmp: "image/bmp",
	svg: "image/svg+xml",
};

function resolveMimeType(fileName: string) {
	const extension = fileName.split(".").pop()?.toLowerCase();
	return (
		(extension && MIME_BY_EXTENSION[extension]) || "application/octet-stream"
	);
}

class ApiMediaSource implements MediaSource {
	type: "image" | "video" | "audio";
	private urls: string[] = [];

	constructor(private media: MediaDetails) {
		this.type =
			media.mediaType === "video"
				? "video"
				: media.mediaType === "audio"
					? "audio"
					: "image";
	}

	async getUrl() {
		const url = buildMediaContentUrl(this.media.mediaSourceId, this.media.id);
		const response = await tauriFetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch media: ${response.status}`);
		}
		const blob = await response.blob();
		const typedBlob = new Blob([blob], {
			type: resolveMimeType(this.media.fileName),
		});
		const blobUrl = URL.createObjectURL(typedBlob);
		this.urls.push(blobUrl);
		return blobUrl;
	}

	revokeUrl(url: string) {
		const idx = this.urls.indexOf(url);
		if (idx !== -1) {
			URL.revokeObjectURL(url);
			this.urls.splice(idx, 1);
		}
	}
}

type MediaViewerProps = {
	media: MediaDetails;
	sourceRootPath?: string | null;
};

export function MediaViewer(props: MediaViewerProps) {
	const source = createMemo(() => new ApiMediaSource(props.media));

	return (
		<SharedMediaViewer
			fileName={props.media.fileName}
			height={props.media.height}
			source={source()}
			width={props.media.width}
		/>
	);
}
