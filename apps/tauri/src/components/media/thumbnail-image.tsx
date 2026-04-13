import type { Media } from "@solid-imager/core/domain/media/schemas";
import { createQuery } from "@tanstack/solid-query";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, isAbsolute, join } from "@tauri-apps/api/path";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { getTauriAppServices } from "../../app-services";
import { configQueryOptions } from "../../infrastructure/api-clients/queries/config-query";

const DEFAULT_MAX_RETRIES = 40;
const DEFAULT_RETRY_DELAY_MS = 1500;
const THUMBNAIL_MIME_TYPE = "image/webp";

type FallbackMode = "none" | "thumbnail-blob" | "original-blob";

type ThumbnailImageProps = {
	alt: string;
	class?: string;
	disableOriginalFallback?: boolean;
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

function appendCacheKey(url: string, cacheKey: number) {
	const separator = url.includes("?") ? "&" : "?";
	return `${url}${separator}t=${cacheKey}`;
}

function joinLocalPath(rootPath: string, relativePath: string) {
	if (/^(?:[A-Za-z]:[\\/]|\/)/.test(relativePath)) {
		return relativePath;
	}
	const separator = rootPath.includes("\\") ? "\\" : "/";
	const normalizedRoot = rootPath.replace(/[\\/]+$/, "");
	const normalizedRelative = relativePath.replace(/^[\\/]+/, "");
	return `${normalizedRoot}${separator}${normalizedRelative.replace(/[\\/]/g, separator)}`;
}

function joinOutputPath(
	basePath: string,
	mediaSourceId: string,
	mediaId: string,
) {
	const separator = basePath.includes("\\") ? "\\" : "/";
	const normalizedBase = basePath.replace(/[\\/]+$/, "");
	return `${normalizedBase}${separator}${mediaSourceId}${separator}${mediaId}.webp`;
}

async function resolveThumbnailBasePath(basePath: string) {
	if (await isAbsolute(basePath)) {
		return basePath;
	}
	return join(await appDataDir(), basePath);
}

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
	const configQuery = createQuery(() => configQueryOptions());
	const [thumbnailUrl, setThumbnailUrl] = createSignal<string | null>(null);
	const [shouldLoad, setShouldLoad] = createSignal(props.loading === "eager");
	const [cacheKey, setCacheKey] = createSignal(0);
	const [retryCount, setRetryCount] = createSignal(0);
	const [thumbnailPath, setThumbnailPath] = createSignal<string | null>(null);
	const [originalPath, setOriginalPath] = createSignal<string | null>(null);
	const [fallbackMode, setFallbackMode] = createSignal<FallbackMode>("none");
	let visibilityRef: HTMLDivElement | undefined;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;

	const replaceThumbnailUrl = (nextUrl: string | null) => {
		setThumbnailUrl((currentUrl) => {
			if (currentUrl !== nextUrl) {
				revokeObjectUrl(currentUrl);
			}
			return nextUrl;
		});
	};

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
		setThumbnailPath(null);
		setOriginalPath(null);
		setFallbackMode("none");
		replaceThumbnailUrl(null);
	};

	createEffect(() => {
		if (props.loading === "eager") {
			setShouldLoad(true);
		}
	});

	createEffect(() => {
		void props.media.id;
		void props.media.modifiedAt;
		void props.sourceRootPath;
		void configQuery.data?.storage.thumbnailDir;
		void props.disableOriginalFallback;
		resetImage();
	});

	createEffect(() => {
		if (props.loading === "eager" || shouldLoad()) {
			return;
		}

		const element = visibilityRef;
		if (!element) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					setShouldLoad(true);
				}
			},
			{ threshold: 0.01, rootMargin: "1000px" },
		);

		observer.observe(element);

		onCleanup(() => {
			observer.disconnect();
		});
	});

	createEffect(() => {
		const rootPath = props.sourceRootPath;
		const storage = configQuery.data?.storage;
		const media = props.media;
		const loadNow = shouldLoad();
		void retryCount();

		if (!(loadNow && rootPath && storage && media.mediaType === "image")) {
			clearRetryTimer();
			setThumbnailPath(null);
			setOriginalPath(null);
			setFallbackMode("none");
			replaceThumbnailUrl(null);
			return;
		}

		let cancelled = false;

		void (async () => {
			const inputPath = joinLocalPath(rootPath, media.filePath);
			const thumbnailBasePath = await resolveThumbnailBasePath(
				storage.thumbnailDir,
			);
			const outputPath = joinOutputPath(
				thumbnailBasePath,
				media.mediaSourceId,
				media.id,
			);

			if (cancelled) {
				return;
			}

			setThumbnailPath(outputPath);
			setOriginalPath(props.disableOriginalFallback ? null : inputPath);
			setFallbackMode("none");
			replaceThumbnailUrl(
				appendCacheKey(convertFileSrc(outputPath), cacheKey()),
			);
		})();

		onCleanup(() => {
			cancelled = true;
		});
	});

	onCleanup(() => {
		clearRetryTimer();
		replaceThumbnailUrl(null);
	});

	const scheduleRetry = () => {
		if (retryCount() >= DEFAULT_MAX_RETRIES) {
			return;
		}

		clearRetryTimer();
		retryTimer = setTimeout(() => {
			setRetryCount((count) => count + 1);
			setCacheKey(Date.now());
		}, DEFAULT_RETRY_DELAY_MS);
	};

	const handleImageError = () => {
		const currentFallbackMode = fallbackMode();
		const currentThumbnailPath = thumbnailPath();
		const currentOriginalPath = originalPath();

		void (async () => {
			if (currentFallbackMode === "none" && currentThumbnailPath) {
				try {
					const thumbnailBytes =
						await fileSystem.readFile(currentThumbnailPath);
					setFallbackMode("thumbnail-blob");
					replaceThumbnailUrl(
						createObjectUrl(thumbnailBytes, THUMBNAIL_MIME_TYPE),
					);
					return;
				} catch {}
			}

			if (currentOriginalPath) {
				try {
					const originalBytes = await fileSystem.readFile(currentOriginalPath);
					setFallbackMode("original-blob");
					replaceThumbnailUrl(
						createObjectUrl(
							originalBytes,
							resolveMimeType(props.media.fileName),
						),
					);
				} catch {
					replaceThumbnailUrl(null);
				}
			} else {
				replaceThumbnailUrl(null);
			}

			scheduleRetry();
		})();
	};

	return (
		<Show
			fallback={
				<div
					class="flex h-full w-full items-center justify-center bg-gray-200 text-gray-400"
					ref={(element) => {
						visibilityRef = element;
					}}
				>
					{props.fallback ?? props.media.mediaType}
				</div>
			}
			when={thumbnailUrl()}
		>
			{(url) => (
				<img
					alt={props.alt}
					class={props.class}
					height={props.height ?? undefined}
					loading={props.loading}
					onError={handleImageError}
					src={url()}
					width={props.width ?? undefined}
				/>
			)}
		</Show>
	);
}
