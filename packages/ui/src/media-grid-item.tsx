import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { cn } from "./utils/cn";

export type MediaGridThumbnailProps = {
	alt: string;
	class: string;
	height?: number | null;
	loading: "eager" | "lazy";
	media: Media;
	sourceRootPath?: string;
	width?: number | null;
};

export type MediaGridLinkProps = {
	children: JSX.Element;
	class: string;
	"data-media-id": string;
	href: string;
	onContextMenu: (event: MouseEvent) => void;
};

type MediaGridItemProps = {
	media: Media;
	linkPrefix?: string;
	priority?: boolean;
	sourceRootPath?: string;
	onContextMenu?: (event: MouseEvent) => void;
	canRenderThumbnail?: (media: Media) => boolean;
	linkComponent: (props: MediaGridLinkProps) => JSX.Element;
	renderThumbnail: (props: MediaGridThumbnailProps) => JSX.Element;
	class?: string;
	thumbnailClass?: string;
	overlayClass?: string;
	isBulkSelectMode?: boolean;
	isSelected?: boolean;
};

export function MediaGridItem(props: MediaGridItemProps) {
	const href = () =>
		props.linkPrefix
			? `${props.linkPrefix}/${props.media.id}`
			: `/sources/${props.media.mediaSourceId}/${props.media.id}`;
	const canRenderThumbnail = () =>
		props.canRenderThumbnail?.(props.media) ??
		props.media.mediaType !== "audio";

	const LinkComponent = props.linkComponent;

	return (
		<LinkComponent
			class={cn(
				"group relative block aspect-[3/4] overflow-hidden rounded-lg bg-gray-100 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
				props.isSelected && "ring-4 ring-blue-500 ring-offset-2",
				props.class,
			)}
			data-media-id={props.media.id}
			href={href()}
			onContextMenu={(event) => props.onContextMenu?.(event)}
		>
			<Show when={props.isBulkSelectMode}>
				<div class="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white bg-black/40 text-white">
					<input
						type="checkbox"
						checked={props.isSelected}
						class="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						readOnly
					/>
				</div>
			</Show>

			<Show
				fallback={
					<div class="flex h-full w-full items-center justify-center bg-gray-200 text-gray-400">
						{props.media.mediaType}
					</div>
				}
				when={canRenderThumbnail()}
			>
				{props.renderThumbnail({
					alt: props.media.fileName,
					class: cn(
						"h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
						props.thumbnailClass,
					),
					height: props.media.height,
					loading: props.priority ? "eager" : "lazy",
					media: props.media,
					sourceRootPath: props.sourceRootPath,
					width: props.media.width,
				})}
			</Show>

			<div
				class={cn(
					"absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100",
					props.overlayClass,
				)}
			>
				<p
					class="truncate font-medium text-white text-xs"
					title={props.media.fileName}
				>
					{props.media.fileName}
				</p>
			</div>
		</LinkComponent>
	);
}
