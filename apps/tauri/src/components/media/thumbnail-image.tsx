import type { MediaSafe } from "@solid-imager/core/domain/media/schemas";
import {
	ThumbnailImage as SharedThumbnailImage,
	type ThumbnailImageProps as SharedThumbnailImageProps,
} from "@solid-imager/ui/thumbnail-image";
import {
	type BuildThumbnailUrlArgs,
	createHttpThumbnailSource,
	type ThumbnailRequestSize,
} from "@solid-imager/ui/thumbnail-source";
import { buildThumbnailUrl } from "~/infrastructure/media/thumbnail-runtime";

type ThumbnailImageProps = {
	alt: string;
	class?: string;
	enabled?: boolean;
	fallback?: string;
	fetchpriority?: "high" | "low" | "auto";
	height?: number | null;
	loading?: "eager" | "lazy";
	maxRetries?: number;
	media: MediaSafe;
	retryDelayMs?: number;
	requestedSize?: ThumbnailRequestSize;
	sizes?: string;
	sourceRootPath?: string;
	width?: number | null;
};

function buildUrl(args: BuildThumbnailUrlArgs): string {
	return buildThumbnailUrl(args);
}

export function ThumbnailImage(props: ThumbnailImageProps) {
	const source = createHttpThumbnailSource({
		buildUrl,
		defaultSize: props.requestedSize ?? (props.sizes ? 512 : undefined),
		maxRetries: props.maxRetries,
		mediaId: props.media.id,
		mediaSourceId: props.media.mediaSourceId,
		modifiedAt: props.media.modifiedAt,
		responsiveSizes: props.sizes ? [256, 512] : undefined,
		retryDelayMs: props.retryDelayMs,
	});
	const sharedProps: SharedThumbnailImageProps = {
		alt: props.alt,
		class: props.class,
		enabled: props.enabled,
		fallback: props.fallback,
		fetchpriority: props.fetchpriority,
		height: props.height,
		loading: props.loading,
		sizes: props.sizes,
		source,
		width: props.width,
	};
	return <SharedThumbnailImage {...sharedProps} />;
}
