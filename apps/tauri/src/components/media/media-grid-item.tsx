import type { Media } from "@solid-imager/core/domain/media/schemas";
import { Link } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { ThumbnailImage } from "./thumbnail-image";

type MediaGridItemProps = {
	linkPrefix?: string;
	media: Media;
	onContextMenu?: (event: MouseEvent) => void;
	priority?: boolean;
	sourceRootPath?: string;
};

export function MediaGridItem(props: MediaGridItemProps) {
	return (
		<Link
			class="group relative block aspect-[3/4] overflow-hidden rounded-lg bg-gray-100 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
			data-media-id={props.media.id}
			onContextMenu={(event) => props.onContextMenu?.(event)}
			params={{
				mediaId: props.media.id,
				mediaSourceId: props.media.mediaSourceId,
			}}
			to="/sources/$mediaSourceId/$mediaId"
		>
			<Show
				fallback={
					<div class="flex h-full w-full items-center justify-center bg-gray-200 text-gray-400">
						{props.media.mediaType}
					</div>
				}
				when={props.media.mediaType === "image"}
			>
				<ThumbnailImage
					alt={props.media.fileName}
					class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
					height={props.media.height}
					loading={props.priority ? "eager" : "lazy"}
					media={props.media}
					sourceRootPath={props.sourceRootPath}
					width={props.media.width}
				/>
			</Show>

			<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
				<p
					class="truncate font-medium text-white text-xs"
					title={props.media.fileName}
				>
					{props.media.fileName}
				</p>
			</div>
		</Link>
	);
}
