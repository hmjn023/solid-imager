import type { Media } from "@solid-imager/core/domain/media/schemas";
import {
	ThumbnailImage as SharedThumbnailImage,
	type ThumbnailImageProps as SharedThumbnailImageProps,
} from "@solid-imager/ui/thumbnail-image";
import {
	type BuildThumbnailUrlArgs,
	createHttpThumbnailSource,
} from "@solid-imager/ui/thumbnail-source";
import { buildThumbnailUrl } from "~/infrastructure/media/thumbnail-runtime";

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

function buildUrl(args: BuildThumbnailUrlArgs): string {
	return buildThumbnailUrl(args);
}

export function ThumbnailImage(props: ThumbnailImageProps) {
	const source = createHttpThumbnailSource({
		buildUrl,
		maxRetries: props.maxRetries,
		mediaId: props.media.id,
		mediaSourceId: props.media.mediaSourceId,
		modifiedAt: props.media.modifiedAt,
		retryDelayMs: props.retryDelayMs,
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
