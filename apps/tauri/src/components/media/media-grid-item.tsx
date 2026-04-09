import type { Media } from "@solid-imager/core/domain/media/schemas";
import { Link } from "@tanstack/solid-router";
import { Show } from "solid-js";

type MediaGridItemProps = {
	linkPrefix?: string;
	media: Media;
	onContextMenu?: (event: MouseEvent) => void;
	priority?: boolean;
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
				<div
					class="flex h-full w-full items-center justify-center text-white/80 text-xs uppercase tracking-[0.3em]"
					style={{
						background:
							"linear-gradient(135deg, rgba(15,23,42,0.18), rgba(15,23,42,0.02)), linear-gradient(135deg, #0f766e, #60a5fa)",
					}}
				>
					Preview
				</div>
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
