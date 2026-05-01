import type { Media } from "@solid-imager/core/domain/media/schemas";
import { createRenderEffect, createSignal, onCleanup } from "solid-js";
import type { ThumbnailSource } from "./thumbnail-image";

const DEFAULT_HTTP_MAX_RETRIES = 10;
const DEFAULT_HTTP_RETRY_DELAY_MS = 1500;
const DEFAULT_LOCAL_MAX_RETRIES = 40;
const DEFAULT_LOCAL_RETRY_DELAY_MS = 1500;
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

export type BuildThumbnailUrlArgs = {
	cacheKey: number;
	mediaId: string;
	mediaSourceId: string;
};

export type CreateHttpThumbnailSourceProps = {
	buildUrl: (args: BuildThumbnailUrlArgs) => string;
	maxRetries?: number;
	mediaId: string;
	mediaSourceId: string;
	modifiedAt: Date | string;
	retryDelayMs?: number;
};

export type ThumbnailResource = {
	filePath: string;
	url: string;
};

export type ObjectUrlAdapter = {
	create(bytes: Uint8Array, mimeType: string): string;
	revoke(url: string): void;
};

export type CreateLocalThumbnailSourceProps = {
	getThumbnailResource: (
		mediaSourceId: string,
		mediaId: string,
		cacheKey: number,
	) => Promise<ThumbnailResource>;
	joinPath: (rootPath: string, filePath: string) => string;
	maxRetries?: number;
	media: Media;
	objectUrl: ObjectUrlAdapter;
	readFile: (path: string) => Promise<Uint8Array>;
	retryDelayMs?: number;
	sourceRootPath?: string;
	subscribeToThumbnailReady: (
		mediaId: string,
		callback: () => void,
	) => () => void;
};

function revokeObjectUrl(adapter: ObjectUrlAdapter, url: string | null) {
	if (url?.startsWith("blob:")) {
		adapter.revoke(url);
	}
}

function resolveMimeType(fileName: string) {
	const extension = fileName.split(".").pop()?.toLowerCase();
	return (
		(extension && MIME_BY_EXTENSION[extension]) || "application/octet-stream"
	);
}

export function createHttpThumbnailSource(
	props: CreateHttpThumbnailSourceProps,
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

	createRenderEffect(() => {
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
			return props.buildUrl({
				cacheKey: cacheKey(),
				mediaId: props.mediaId,
				mediaSourceId: props.mediaSourceId,
			});
		},
		onLoad() {
			clearRetryTimer();
		},
		onError() {
			if (retryCount() >= (props.maxRetries ?? DEFAULT_HTTP_MAX_RETRIES)) {
				return;
			}
			clearRetryTimer();
			retryTimer = setTimeout(() => {
				setRetryCount((prev) => prev + 1);
				setCacheKey(Date.now());
			}, props.retryDelayMs ?? DEFAULT_HTTP_RETRY_DELAY_MS);
		},
	};
}

export function createLocalThumbnailSource(
	props: CreateLocalThumbnailSourceProps,
): ThumbnailSource {
	const [url, setUrl] = createSignal<string | null>(null);
	const [fallbackUrl, setFallbackUrl] = createSignal<string | null>(null);
	const [thumbnailFilePath, setThumbnailFilePath] = createSignal<string | null>(
		null,
	);
	const [retryCount, setRetryCount] = createSignal(0);
	let retryTimer: ReturnType<typeof setTimeout> | undefined;
	let revokeOnLoad: string | null = null;
	let lastRequestId = 0;

	const clearRetryTimer = () => {
		if (retryTimer) {
			clearTimeout(retryTimer);
			retryTimer = undefined;
		}
	};

	const scheduleRetry = () => {
		if (retryCount() >= (props.maxRetries ?? DEFAULT_LOCAL_MAX_RETRIES)) {
			return;
		}
		clearRetryTimer();
		retryTimer = setTimeout(() => {
			setRetryCount((count) => count + 1);
			void loadThumbnail();
		}, props.retryDelayMs ?? DEFAULT_LOCAL_RETRY_DELAY_MS);
	};

	const loadThumbnail = async () => {
		lastRequestId += 1;
		const requestId = lastRequestId;
		try {
			const resource = await props.getThumbnailResource(
				props.media.mediaSourceId,
				props.media.id,
				new Date(props.media.modifiedAt).getTime(),
			);
			if (requestId !== lastRequestId) {
				return;
			}
			setThumbnailFilePath(resource.filePath);
			setUrl(resource.url);
		} catch {
			if (requestId !== lastRequestId) {
				return;
			}
			setThumbnailFilePath(null);
			setUrl(null);
		}
	};

	const setBlobFallbackUrl = (blobUrl: string) => {
		setFallbackUrl((current) => {
			revokeObjectUrl(props.objectUrl, current);
			return blobUrl;
		});
		revokeOnLoad = blobUrl;
	};

	const handleOriginalFallback = async (rootPath: string | undefined) => {
		if (rootPath && !fallbackUrl()) {
			try {
				const bytes = await props.readFile(
					props.joinPath(rootPath, props.media.filePath),
				);
				setBlobFallbackUrl(
					props.objectUrl.create(bytes, resolveMimeType(props.media.fileName)),
				);
				scheduleRetry();
			} catch {
				scheduleRetry();
			}
			return;
		}
		scheduleRetry();
	};

	createRenderEffect(() => {
		void props.media.id;
		void props.media.mediaSourceId;
		void props.media.modifiedAt;
		clearRetryTimer();
		setRetryCount(0);
		setFallbackUrl((current) => {
			revokeObjectUrl(props.objectUrl, current);
			return null;
		});
		setThumbnailFilePath(null);
		setUrl(null);
		void loadThumbnail();
	});

	onCleanup(() => {
		clearRetryTimer();
		const current = fallbackUrl();
		if (current) {
			revokeObjectUrl(props.objectUrl, current);
		}
		if (revokeOnLoad && revokeOnLoad !== current) {
			revokeObjectUrl(props.objectUrl, revokeOnLoad);
		}
	});

	return {
		async getUrl() {
			return fallbackUrl() ?? url() ?? "";
		},
		subscribe(callback) {
			return props.subscribeToThumbnailReady(props.media.id, () => {
				clearRetryTimer();
				setRetryCount(0);
				void loadThumbnail().finally(callback);
			});
		},
		onLoad() {
			clearRetryTimer();
			if (revokeOnLoad) {
				revokeObjectUrl(props.objectUrl, revokeOnLoad);
				revokeOnLoad = null;
			}
		},
		async onError() {
			setUrl(null);
			const currentThumbnailFilePath = thumbnailFilePath();
			const rootPath = props.sourceRootPath;

			if (currentThumbnailFilePath) {
				try {
					const bytes = await props.readFile(currentThumbnailFilePath);
					setBlobFallbackUrl(
						props.objectUrl.create(bytes, THUMBNAIL_MIME_TYPE),
					);
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
