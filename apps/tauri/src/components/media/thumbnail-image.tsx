import type { Media } from "@solid-imager/core/domain/media/schemas";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { getTauriAppServices } from "../../app-services";
import { getThumbnailResource } from "../../infrastructure/media/thumbnail-runtime";
import { joinLocalPath } from "../../infrastructure/path-utils";

const DEFAULT_MAX_RETRIES = 40;
const DEFAULT_RETRY_DELAY_MS = 1500;
const THUMBNAIL_MIME_TYPE = "image/webp";

type ThumbnailImageProps = {
	alt: string;
	class?: string;
	fallback?: string;
	height?: number | null;
	loading?: "eager" | "lazy";
	media: Media;
	sourceRootPath?: string;
	width?: number | null;
};

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

export function ThumbnailImage(props: ThumbnailImageProps) {
	const fileSystem = getTauriAppServices().fileSystem;
	const [thumbnailUrl, setThumbnailUrl] = createSignal<string | null>(null);
	const [cacheKey, setCacheKey] = createSignal(0);
	const [retryCount, setRetryCount] = createSignal(0);
	const [thumbnailFilePath, setThumbnailFilePath] = createSignal<string | null>(
		null,
	);
	const [originalUrl, setOriginalUrl] = createSignal<string | null>(null);
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
		setCacheKey(new Date(props.media.modifiedAt).getTime());
		setOriginalUrl((currentUrl) => {
			revokeObjectUrl(currentUrl);
			return null;
		});
		setThumbnailFilePath(null);
		setThumbnailUrl(null);
	};

	createEffect(() => {
		void props.media.id;
		void props.media.mediaSourceId;
		void props.media.modifiedAt;
		resetImage();
	});

	createEffect(() => {
		const media = props.media;
		const nextCacheKey = cacheKey();
		let cancelled = false;

		void (async () => {
			try {
				const resource = await getThumbnailResource(
					media.mediaSourceId,
					media.id,
					nextCacheKey,
				);
				if (!cancelled) {
					setThumbnailFilePath(resource.filePath);
					setThumbnailUrl(resource.url);
				}
			} catch {
				if (!cancelled) {
					setThumbnailFilePath(null);
					setThumbnailUrl(null);
				}
			}
		})();

		onCleanup(() => {
			cancelled = true;
		});
	});

	onCleanup(() => {
		clearRetryTimer();
		setThumbnailUrl((currentUrl) => {
			revokeObjectUrl(currentUrl);
			return null;
		});
		setOriginalUrl((currentUrl) => {
			revokeObjectUrl(currentUrl);
			return null;
		});
	});

	const handleLoad = () => {
		clearRetryTimer();
	};

	const handleError = () => {
		setThumbnailUrl(null);
		const currentThumbnailFilePath = thumbnailFilePath();
		const rootPath = props.sourceRootPath;

		if (currentThumbnailFilePath) {
			void (async () => {
				try {
					const bytes = await fileSystem.readFile(currentThumbnailFilePath);
					setOriginalUrl((currentUrl) => {
						revokeObjectUrl(currentUrl);
						return createObjectUrl(bytes, THUMBNAIL_MIME_TYPE);
					});
					clearRetryTimer();
				} catch {
					setThumbnailFilePath(null);
					handleOriginalFallback(rootPath);
				}
			})();
			return;
		}

		handleOriginalFallback(rootPath);
	};

	const handleOriginalFallback = (rootPath: string | undefined) => {
		if (rootPath && !originalUrl()) {
			void (async () => {
				try {
					const bytes = await fileSystem.readFile(
						joinLocalPath(rootPath, props.media.filePath),
					);
					setOriginalUrl((currentUrl) => {
						revokeObjectUrl(currentUrl);
						return createObjectUrl(bytes, resolveMimeType(props.media.fileName));
					});
					clearRetryTimer();
				} catch {
					if (retryCount() >= DEFAULT_MAX_RETRIES) {
						return;
					}

					clearRetryTimer();
					retryTimer = setTimeout(() => {
						setRetryCount((count) => count + 1);
						setCacheKey(Date.now());
					}, DEFAULT_RETRY_DELAY_MS);
				}
			})();
			return;
		}

		if (retryCount() >= DEFAULT_MAX_RETRIES) {
			return;
		}

		clearRetryTimer();
		retryTimer = setTimeout(() => {
			setRetryCount((count) => count + 1);
			setCacheKey(Date.now());
		}, DEFAULT_RETRY_DELAY_MS);
	};

	return (
		<Show
			fallback={
				<div class="flex h-full w-full items-center justify-center bg-gray-200 text-gray-400">
					{props.fallback ?? props.media.mediaType}
				</div>
			}
			when={thumbnailUrl() || originalUrl()}
		>
			{(url) => (
				<img
					alt={props.alt}
					class={props.class}
					height={props.height ?? undefined}
					loading={props.loading}
					onError={handleError}
					onLoad={handleLoad}
					src={url()}
					width={props.width ?? undefined}
				/>
			)}
		</Show>
	);
}
