import {
	ThumbnailImage as SharedThumbnailImage,
	type ThumbnailImageProps as SharedThumbnailImageProps,
	type ThumbnailSource,
} from "@solid-imager/ui/thumbnail-image";
import { createEffect, createSignal, onCleanup } from "solid-js";

const DEFAULT_MAX_RETRIES = 10;
const DEFAULT_RETRY_DELAY_MS = 1500;

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

function createHttpThumbnailSource(
	props: ThumbnailImageProps,
): ThumbnailSource {
	const [cacheKey, setCacheKey] = createSignal(0);
	const [retryCount, setRetryCount] = createSignal(0);
	let retryTimer: ReturnType<typeof setTimeout> | undefined;

	const clearRetryTimer = () => {
		if (retryTimer) {
			clearTimeout(retryTimer);
			retryTimer = undefined;
		}
	};

	createEffect(() => {
		void props.mediaId;
		void props.mediaSourceId;
		void props.modifiedAt;
		clearRetryTimer();
		setRetryCount(0);
		setCacheKey(new Date(props.modifiedAt).getTime());
	});

	onCleanup(() => {
		clearRetryTimer();
	});

	return {
		getUrl() {
			return `/api/sources/${props.mediaSourceId}/${props.mediaId}/thumbnail?t=${cacheKey()}`;
		},
		onLoad() {
			clearRetryTimer();
		},
		onError() {
			if (retryCount() >= (props.maxRetries ?? DEFAULT_MAX_RETRIES)) {
				return;
			}
			clearRetryTimer();
			retryTimer = setTimeout(() => {
				setRetryCount((prev) => prev + 1);
				setCacheKey(Date.now());
			}, props.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
		},
	};
}

export function ThumbnailImage(props: ThumbnailImageProps) {
	const source = createHttpThumbnailSource(props);
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
