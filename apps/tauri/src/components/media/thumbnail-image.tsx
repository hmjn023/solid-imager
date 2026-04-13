import type { Media } from "@solid-imager/core/domain/media/schemas";
import { createQuery } from "@tanstack/solid-query";
import { appDataDir, isAbsolute, join } from "@tauri-apps/api/path";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { getTauriAppServices } from "../../app-services";
import { configQueryOptions } from "../../infrastructure/api-clients/queries/config-query";

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

function toObjectUrl(bytes: Uint8Array, mimeType: string) {
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
}

export function ThumbnailImage(props: ThumbnailImageProps) {
	const services = getTauriAppServices();
	const configQuery = createQuery(() => configQueryOptions());
	const [thumbnailUrl, setThumbnailUrl] = createSignal<string | null>(null);
	const [shouldLoad, setShouldLoad] = createSignal(props.loading === "eager");
	let visibilityRef: HTMLDivElement | undefined;

	createEffect(() => {
		if (props.loading === "eager") {
			setShouldLoad(true);
		}
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
		let disposed = false;
		let currentUrl: string | null = null;

		const revokeCurrentUrl = () => {
			if (currentUrl) {
				URL.revokeObjectURL(currentUrl);
				currentUrl = null;
			}
		};

		if (!(loadNow && rootPath && storage && media.mediaType === "image")) {
			revokeCurrentUrl();
			setThumbnailUrl(null);
			return;
		}

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

			try {
				const thumbnailBytes = await services.fileSystem.readFile(outputPath);
				if (disposed) {
					return;
				}
				revokeCurrentUrl();
				currentUrl = toObjectUrl(thumbnailBytes, "image/webp");
				setThumbnailUrl(currentUrl);
			} catch {
				if (props.disableOriginalFallback) {
					if (!disposed) {
						revokeCurrentUrl();
						setThumbnailUrl(null);
					}
					return;
				}
				try {
					const originalBytes = await services.fileSystem.readFile(inputPath);
					if (disposed) {
						return;
					}
					revokeCurrentUrl();
					currentUrl = toObjectUrl(originalBytes, "application/octet-stream");
					setThumbnailUrl(currentUrl);
				} catch {
					if (!disposed) {
						revokeCurrentUrl();
						setThumbnailUrl(null);
					}
				}
			}
		})();

		onCleanup(() => {
			disposed = true;
			revokeCurrentUrl();
		});
	});

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
					src={url()}
					width={props.width ?? undefined}
				/>
			)}
		</Show>
	);
}
