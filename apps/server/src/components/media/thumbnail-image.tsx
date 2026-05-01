import {
	ThumbnailImage as SharedThumbnailImage,
	type ThumbnailImageProps as SharedThumbnailImageProps,
} from "@solid-imager/ui/thumbnail-image";
import { createHttpThumbnailSource } from "@solid-imager/ui/thumbnail-source";

type ThumbnailImageProps = {
	alt: string;
	class?: string;
	height?: number | null;
	loading?: "eager" | "lazy";
	maxRetries?: number;
	mediaId: string;
	mediaSourceId: string;
	modifiedAt: Date | string;
	retryDelayMs?: number;
	width?: number | null;
};

export function ThumbnailImage(props: ThumbnailImageProps) {
	const source = createHttpThumbnailSource({
		buildUrl: ({ cacheKey, mediaId, mediaSourceId }) =>
			`/api/sources/${mediaSourceId}/${mediaId}/thumbnail?t=${cacheKey}`,
		maxRetries: props.maxRetries,
		mediaId: props.mediaId,
		mediaSourceId: props.mediaSourceId,
		modifiedAt: props.modifiedAt,
		retryDelayMs: props.retryDelayMs,
	});
	const sharedProps: SharedThumbnailImageProps = {
		alt: props.alt,
		class: props.class,
		height: props.height,
		loading: props.loading,
		source,
		width: props.width,
	};
	return <SharedThumbnailImage {...sharedProps} />;
}
