import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import {
	type MediaSource,
	V2MediaViewer as SharedV2MediaViewer,
} from "@solid-imager/ui/v2-media-viewer";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { buildMediaContentUrl } from "~/infrastructure/media/thumbnail-runtime";
import { getApiFetch } from "~/infrastructure/tauri-fetch-helpers";

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

class TauriMediaSource implements MediaSource {
	type: "image" | "video" | "audio";
	private urls: string[] = [];

	constructor(private readonly media: MediaDetails) {
		this.type =
			media.mediaType === "video"
				? "video"
				: media.mediaType === "audio"
					? "audio"
					: "image";
	}

	async getUrl() {
		const url = buildMediaContentUrl(this.media.mediaSourceId, this.media.id);
		const response = await getApiFetch()(url, { cache: "no-store" });
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
		const index = this.urls.indexOf(url);
		if (index === -1) return;
		URL.revokeObjectURL(url);
		this.urls.splice(index, 1);
	}

	cleanup() {
		for (const url of this.urls) URL.revokeObjectURL(url);
		this.urls = [];
	}
}

export function V2MediaViewer(props: { media: MediaDetails }) {
	const [source, setSource] = createSignal<TauriMediaSource>(
		new TauriMediaSource(props.media),
	);

	createEffect((previous: TauriMediaSource | undefined) => {
		previous?.cleanup();
		const next = new TauriMediaSource(props.media);
		setSource(next);
		return next;
	});

	onCleanup(() => source().cleanup());

	return (
		<SharedV2MediaViewer
			fileName={props.media.fileName}
			height={props.media.height}
			source={source()}
			width={props.media.width}
		/>
	);
}
