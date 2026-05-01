import type { Media } from "@solid-imager/core/domain/media/schemas";
import {
	ThumbnailImage as SharedThumbnailImage,
	type ThumbnailImageProps as SharedThumbnailImageProps,
} from "@solid-imager/ui/thumbnail-image";
import { createLocalThumbnailSource } from "@solid-imager/ui/thumbnail-source";
import { getTauriAppServices } from "~/app-services";
import {
	getThumbnailResource,
	subscribeToThumbnailReady,
} from "~/infrastructure/media/thumbnail-runtime";
import { joinLocalPath } from "~/infrastructure/path-utils";

function createObjectUrl(bytes: Uint8Array, mimeType: string) {
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
}

type ThumbnailImageProps = {
	alt: string;
	class?: string;
	fallback?: string;
	height?: number | null;
	loading?: "eager" | "lazy";
	maxRetries?: number;
	media: Media;
	retryDelayMs?: number;
	sourceRootPath?: string;
	width?: number | null;
};

export function ThumbnailImage(props: ThumbnailImageProps) {
	const fileSystem = getTauriAppServices().fileSystem;
	const source = createLocalThumbnailSource({
		getThumbnailResource,
		joinPath: joinLocalPath,
		maxRetries: props.maxRetries,
		media: props.media,
		objectUrl: {
			create: createObjectUrl,
			revoke: (url) => URL.revokeObjectURL(url),
		},
		readFile: (path) => fileSystem.readFile(path),
		retryDelayMs: props.retryDelayMs,
		sourceRootPath: props.sourceRootPath,
		subscribeToThumbnailReady,
	});
	const sharedProps: SharedThumbnailImageProps = {
		alt: props.alt,
		class: props.class,
		fallback: props.fallback,
		height: props.height,
		loading: props.loading,
		source,
		width: props.width,
	};
	return <SharedThumbnailImage {...sharedProps} />;
}
