import type { Media } from "@solid-imager/core/domain/media/schemas";
import {
	ThumbnailImage as SharedThumbnailImage,
	type ThumbnailImageProps as SharedThumbnailImageProps,
	type ThumbnailSource,
} from "@solid-imager/ui/thumbnail-image";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { getTauriAppServices } from "~/app-services";
import {
	getThumbnailResource,
	subscribeToThumbnailReady,
} from "~/infrastructure/media/thumbnail-runtime";
import { joinLocalPath } from "~/infrastructure/path-utils";

const DEFAULT_MAX_RETRIES = 40;
const DEFAULT_RETRY_DELAY_MS = 1500;
const THUMBNAIL_MIME_TYPE = "image/webp";

const MIME_BY_EXTENSION: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
	gif: "image/gif",
	bmp: "image/bmp",
	svg: "image/svg+xml",
};

function revokeObjectUrl(url: string | null) {
	if (url?.startsWith("blob:")) {
		URL.revokeObjectURL(url);
	}
}

function resolveMimeType(fileName: string) {
	const extension = fileName.split(".").pop()?.toLowerCase();
	return (
		(extension && MIME_BY_EXTENSION[extension]) || "application/octet-stream"
	);
}

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

function createLocalThumbnailSource(
	props: ThumbnailImageProps,
): ThumbnailSource {
	const fileSystem = getTauriAppServices().fileSystem;
	const [url, setUrl] = createSignal<string | null>(null);
	const [fallbackUrl, setFallbackUrl] = createSignal<string | null>(null);
	const [thumbnailFilePath, setThumbnailFilePath] = createSignal<string | null>(
		null,
	);
	const [retryCount, setRetryCount] = createSignal(0);
	let retryTimer: ReturnType<typeof setTimeout> | undefined;
	let revokeOnLoad: string | null = null;

	const clearRetryTimer = () => {
		if (retryTimer) {
			clearTimeout(retryTimer);
			retryTimer = undefined;
		}
	};

	const scheduleRetry = () => {
		if (retryCount() >= (props.maxRetries ?? DEFAULT_MAX_RETRIES)) {
			return;
		}
		clearRetryTimer();
		retryTimer = setTimeout(() => {
			setRetryCount((count) => count + 1);
			loadThumbnail();
		}, props.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
	};

	const loadThumbnail = async () => {
		try {
			const resource = await getThumbnailResource(
				props.media.mediaSourceId,
				props.media.id,
				Date.now(),
			);
			setThumbnailFilePath(resource.filePath);
			setUrl(resource.url);
		} catch {
			setThumbnailFilePath(null);
			setUrl(null);
		}
	};

	const handleOriginalFallback = async (rootPath: string | undefined) => {
		if (rootPath && !fallbackUrl()) {
			try {
				const bytes = await fileSystem.readFile(
					joinLocalPath(rootPath, props.media.filePath),
				);
				const blobUrl = createObjectUrl(
					bytes,
					resolveMimeType(props.media.fileName),
				);
				setFallbackUrl((current) => {
					revokeObjectUrl(current);
					return blobUrl;
				});
				revokeOnLoad = blobUrl;
				scheduleRetry();
			} catch {
				scheduleRetry();
			}
			return;
		}
		scheduleRetry();
	};

	createEffect(() => {
		void props.media.id;
		void props.media.mediaSourceId;
		void props.media.modifiedAt;
		clearRetryTimer();
		setRetryCount(0);
		setFallbackUrl((current) => {
			revokeObjectUrl(current);
			return null;
		});
		setThumbnailFilePath(null);
		setUrl(null);
		loadThumbnail();
	});

	onMount(() => {
		const unsubscribe = subscribeToThumbnailReady(props.media.id, () => {
			clearRetryTimer();
			setRetryCount(0);
			loadThumbnail();
		});
		onCleanup(unsubscribe);
	});

	onCleanup(() => {
		clearRetryTimer();
		setFallbackUrl((current) => {
			revokeObjectUrl(current);
			return null;
		});
		if (revokeOnLoad) {
			revokeObjectUrl(revokeOnLoad);
		}
	});

	return {
		async getUrl() {
			return fallbackUrl() ?? url() ?? "";
		},
		subscribe(callback) {
			return subscribeToThumbnailReady(props.media.id, callback);
		},
		onLoad() {
			clearRetryTimer();
			if (revokeOnLoad) {
				revokeObjectUrl(revokeOnLoad);
				revokeOnLoad = null;
			}
		},
		async onError() {
			setUrl(null);
			const currentThumbnailFilePath = thumbnailFilePath();
			const rootPath = props.sourceRootPath;

			if (currentThumbnailFilePath) {
				try {
					const bytes = await fileSystem.readFile(currentThumbnailFilePath);
					const blobUrl = createObjectUrl(bytes, THUMBNAIL_MIME_TYPE);
					setFallbackUrl((current) => {
						revokeObjectUrl(current);
						return blobUrl;
					});
					revokeOnLoad = blobUrl;
					clearRetryTimer();
				} catch {
					setThumbnailFilePath(null);
					await handleOriginalFallback(rootPath);
				}
				return;
			}

			await handleOriginalFallback(rootPath);
		},
	};
}

export function ThumbnailImage(props: ThumbnailImageProps) {
	const source = createLocalThumbnailSource(props);
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
