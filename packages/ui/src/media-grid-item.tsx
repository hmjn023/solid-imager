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
	"aria-pressed"?: boolean;
	onClick?: (event: MouseEvent) => void;
	onContextMenu: (event: MouseEvent) => void;
};

type MediaGridItemProps = {
	variant?: "default" | "v2";
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
				props.variant === "v2"
					? "group relative block aspect-[4/3] overflow-hidden rounded-md bg-[var(--v2-surface-muted)] outline-none ring-offset-2 ring-offset-[var(--v2-canvas)] transition focus-visible:ring-2 focus-visible:ring-[var(--v2-focus)]"
					: "group relative block aspect-[3/4] overflow-hidden rounded-lg bg-gray-100 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
				props.isSelected &&
					(props.variant === "v2"
						? "ring-2 ring-[var(--v2-focus)]"
						: "ring-4 ring-blue-500 ring-offset-2"),
				props.class,
			)}
			data-media-id={props.media.id}
			href={href()}
			aria-pressed={
				props.isBulkSelectMode || props.variant === "v2"
					? props.isSelected
					: undefined
			}
			onClick={undefined}
			onContextMenu={(event) => props.onContextMenu?.(event)}
		>
			<Show
				when={
					props.isBulkSelectMode || (props.variant === "v2" && props.isSelected)
				}
			>
				<div
					aria-hidden="true"
					class="absolute top-2 right-2 z-10 flex size-6 items-center justify-center rounded-full border border-white bg-black/55 font-bold text-white text-xs shadow-sm"
				>
					{props.isSelected ? "✓" : ""}
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
						"h-full w-full object-cover",
						props.variant === "v2"
							? "transition duration-200 group-hover:scale-[1.015] motion-reduce:transition-none"
							: "transition-transform duration-300 group-hover:scale-105",
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
					"absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
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
