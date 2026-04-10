import type { Media } from "@solid-imager/core/domain/media/schemas";
import { createQuery } from "@tanstack/solid-query";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { getTauriAppServices } from "../../app-services";
import { configQueryOptions } from "../../infrastructure/api-clients/queries/config-query";

type ThumbnailImageProps = {
	alt: string;
	class?: string;
	fallback?: string;
	height?: number | null;
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

function toObjectUrl(bytes: Uint8Array) {
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return URL.createObjectURL(new Blob([buffer], { type: "image/webp" }));
}

function toOriginalObjectUrl(bytes: Uint8Array) {
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return URL.createObjectURL(new Blob([buffer]));
}

export function ThumbnailImage(props: ThumbnailImageProps) {
	const services = getTauriAppServices();
	const configQuery = createQuery(() => configQueryOptions());
	const [thumbnailUrl, setThumbnailUrl] = createSignal<string | null>(null);

	createEffect(() => {
		const rootPath = props.sourceRootPath;
		const media = props.media;
		const storage = configQuery.data?.storage;
		let disposed = false;
		let currentUrl: string | null = null;

		const revokeCurrentUrl = () => {
			if (currentUrl) {
				URL.revokeObjectURL(currentUrl);
				currentUrl = null;
			}
		};

		if (!(rootPath && storage && media.mediaType === "image")) {
			revokeCurrentUrl();
			setThumbnailUrl(null);
			return;
		}

		void (async () => {
			const inputPath = joinLocalPath(rootPath, media.filePath);
			const outputPath = joinOutputPath(
				storage.thumbnailDir,
				media.mediaSourceId,
				media.id,
			);

			try {
				if (!(await services.fileSystem.exists(outputPath))) {
					await services.imageProcessor.generateThumbnail(
						inputPath,
						outputPath,
						storage.thumbnailSize,
						storage.thumbnailQuality,
					);
				}

				const thumbnailBytes = await services.fileSystem.readFile(outputPath);
				if (disposed) {
					return;
				}
				revokeCurrentUrl();
				currentUrl = toObjectUrl(thumbnailBytes);
				setThumbnailUrl(currentUrl);
			} catch {
				try {
					const originalBytes = await services.fileSystem.readFile(inputPath);
					if (disposed) {
						return;
					}
					revokeCurrentUrl();
					currentUrl = toOriginalObjectUrl(originalBytes);
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
				<div class="flex h-full w-full items-center justify-center bg-gray-200 text-gray-400">
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
					src={url()}
					width={props.width ?? undefined}
				/>
			)}
		</Show>
	);
}
