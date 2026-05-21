import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import {
	type MediaSource,
	MediaViewer as SharedMediaViewer,
} from "@solid-imager/ui/media-viewer";
import { createMemo } from "solid-js";
import { getTauriAppServices } from "~/app-services";
import { joinLocalPath } from "~/infrastructure/path-utils";

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

class LocalMediaSource implements MediaSource {
	type: "image" | "video" | "audio";
	private urls: string[] = [];

	constructor(
		private media: MediaDetails,
		private sourceRootPath: string | null,
	) {
		this.type =
			media.mediaType === "video"
				? "video"
				: media.mediaType === "audio"
					? "audio"
					: "image";
	}

	async getUrl() {
		const rootPath = this.sourceRootPath;
		if (!rootPath) {
			throw new Error("No root path");
		}
		const bytes = await getTauriAppServices().fileSystem.readFile(
			joinLocalPath(rootPath, this.media.filePath),
		);
		const buffer = new ArrayBuffer(bytes.byteLength);
		new Uint8Array(buffer).set(bytes);
		const url = URL.createObjectURL(
			new Blob([buffer], { type: resolveMimeType(this.media.fileName) }),
		);
		this.urls.push(url);
		return url;
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
	const source = createMemo(
		() => new LocalMediaSource(props.media, props.sourceRootPath ?? null),
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
