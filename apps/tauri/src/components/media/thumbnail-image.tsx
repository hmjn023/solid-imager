import type { Media } from "@solid-imager/core/domain/media/schemas";
import { createQuery } from "@tanstack/solid-query";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, isAbsolute, join } from "@tauri-apps/api/path";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
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

export function ThumbnailImage(props: ThumbnailImageProps) {
	const configQuery = createQuery(() => configQueryOptions());
	const [thumbnailUrl, setThumbnailUrl] = createSignal<string | null>(null);
	const [shouldLoad, setShouldLoad] = createSignal(props.loading === "eager");
	const [originalUrl, setOriginalUrl] = createSignal<string | null>(null);
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

		if (!(loadNow && rootPath && storage && media.mediaType === "image")) {
			setThumbnailUrl(null);
			setOriginalUrl(null);
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

			setOriginalUrl(
				props.disableOriginalFallback ? null : convertFileSrc(inputPath),
			);
			setThumbnailUrl(convertFileSrc(outputPath));
		})();
	});

	const handleImageError = () => {
		const fallbackUrl = originalUrl();
		if (!(fallbackUrl && thumbnailUrl() !== fallbackUrl)) {
			setThumbnailUrl(null);
			return;
		}
		setThumbnailUrl(fallbackUrl);
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
