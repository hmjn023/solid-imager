import type { Media } from "@solid-imager/core/domain/media/schemas";
import { Show } from "solid-js";

type MediaGridItemProps = {
	media: Media;
	/**
	 * Optional prefix for the link href. Defaults to `/sources`.
	 * Example: `/sources/${media.mediaSourceId}/${media.id}`
	 */
	linkPrefix?: string;
	/**
	 * If true, the image will be loaded eagerly.
	 */
	priority?: boolean;
	/**
	 * Optional context menu handler.
	 */
	onContextMenu?: (e: MouseEvent) => void;
};

export function MediaGridItem(props: MediaGridItemProps) {
	const href = () =>
		props.linkPrefix
			? `${props.linkPrefix}/${props.media.id}`
			: `/sources/${props.media.mediaSourceId}/${props.media.id}`;

	const thumbnailUrl = () =>
		`/api/sources/${props.media.mediaSourceId}/${props.media.id}/thumbnail?t=${new Date(
			props.media.modifiedAt,
		).getTime()}`;

	return (
		<a
			class="group relative block aspect-[3/4] overflow-hidden rounded-lg bg-gray-100 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
			data-media-id={props.media.id}
			href={href()}
			onContextMenu={(e) => props.onContextMenu?.(e)}
		>
			<Show
				fallback={
					<div class="flex h-full w-full items-center justify-center bg-gray-200 text-gray-400">
						{props.media.mediaType}
					</div>
				}
				when={props.media.mediaType === "image"}
			>
				{/* biome-ignore lint/performance/noImgElement: No optimized Image component available */}
				<img
					alt={props.media.fileName}
					class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
					height={props.media.height}
					loading={props.priority ? "eager" : "lazy"}
					src={thumbnailUrl()}
					width={props.media.width}
				/>
			</Show>

			{/* Overlay with file name on hover */}
			<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
				<p
					class="truncate font-medium text-white text-xs"
					title={props.media.fileName}
				>
					{props.media.fileName}
				</p>
			</div>
		</a>
	);
}
