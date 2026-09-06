import type { MediaSafe } from "@solid-imager/core/domain/media/schemas";
import { ThumbnailImage as SharedThumbnailImage } from "@solid-imager/ui/thumbnail-image";
import {
	type BuildThumbnailUrlArgs,
	createHttpThumbnailSource,
	type ThumbnailRequestSize,
} from "@solid-imager/ui/thumbnail-source";
import { createMemo } from "solid-js";

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

export function buildThumbnailUrl(args: BuildThumbnailUrlArgs): string {
	const base = `/api/sources/${args.mediaSourceId}/thumbnail/${args.mediaId}`;
	const query = new URLSearchParams();
	if (args.size) query.set("size", String(args.size));
	if (args.cacheKey) query.set("t", String(args.cacheKey));
	const search = query.toString();
	return search ? `${base}?${search}` : base;
}

export function ThumbnailImage(props: ThumbnailImageProps) {
	const source = createMemo(() =>
		createHttpThumbnailSource({
			buildUrl: buildThumbnailUrl,
			defaultSize: props.requestedSize ?? (props.sizes ? 512 : undefined),
			maxRetries: props.maxRetries,
			mediaId: props.media.id,
			mediaSourceId: props.media.mediaSourceId,
			modifiedAt: props.media.modifiedAt,
			responsiveSizes: props.sizes ? [256, 512] : undefined,
			retryDelayMs: props.retryDelayMs,
		}),
	);
	return (
		<SharedThumbnailImage
			alt={props.alt}
			class={props.class}
			enabled={props.enabled}
			fallback={props.fallback}
			fetchpriority={props.fetchpriority}
			height={props.height}
			loading={props.loading}
			sizes={props.sizes}
			source={source()}
			width={props.width}
		/>
	);
}
