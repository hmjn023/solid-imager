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

function getThumbnailUrl(
	mediaSourceId: string,
	mediaId: string,
	cacheKey: number,
): string {
	return `/api/sources/${mediaSourceId}/${mediaId}/thumbnail?t=${cacheKey}`;
}

export function ThumbnailImage(props: ThumbnailImageProps) {
	const [cacheKey, setCacheKey] = createSignal(0);
	const [retryCount, setRetryCount] = createSignal(0);
	let retryTimer: ReturnType<typeof setTimeout> | undefined;

	const clearRetryTimer = () => {
		if (retryTimer) {
			clearTimeout(retryTimer);
			retryTimer = undefined;
		}
	};

	const resetImage = () => {
		clearRetryTimer();
		setRetryCount(0);
		setCacheKey(new Date(props.modifiedAt).getTime());
	};

	createEffect(() => {
		void props.mediaId;
		void props.mediaSourceId;
		void props.modifiedAt;
		resetImage();
	});

	onCleanup(() => {
		clearRetryTimer();
	});

	const handleLoad = () => {
		clearRetryTimer();
	};

	const handleError = () => {
		if (retryCount() >= (props.maxRetries ?? DEFAULT_MAX_RETRIES)) {
			return;
		}

		clearRetryTimer();
		retryTimer = setTimeout(() => {
			setRetryCount((prev) => prev + 1);
			setCacheKey(Date.now());
		}, props.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
	};

	return (
		<img
			alt={props.alt}
			class={props.class}
			height={props.height ?? undefined}
			loading={props.loading}
			onError={handleError}
			onLoad={handleLoad}
			src={getThumbnailUrl(props.mediaSourceId, props.mediaId, cacheKey())}
			width={props.width ?? undefined}
		/>
	);
}
