import type { Media } from "@solid-imager/core/media";
import type { JSX } from "solid-js";
import { mergeProps, Show } from "solid-js";
import { cn } from "./utils/cn";

export const MEDIA_GRID_IMAGE_SIZES =
	"(min-width: 1536px) 12vw, (min-width: 1120px) 14vw, (min-width: 960px) 17vw, (min-width: 640px) 25vw, 50vw";

export type MediaGridImageLoadPolicy = {
	enabled?: boolean;
	fetchpriority?: "high" | "low" | "auto";
	loading?: "eager" | "lazy";
};

export type MediaGridMedia = Pick<
	Media,
	"id" | "mediaSourceId" | "fileName" | "mediaType" | "width" | "height"
>;

type TileThumbnailProps = {
	alt: string;
	class: string;
	enabled?: boolean;
	fetchpriority?: "high" | "low" | "auto";
	height?: number | null;
	loading: "eager" | "lazy";
	sizes?: string;
	width?: number | null;
};

export type MediaGridThumbnailProps<TMedia extends MediaGridMedia = Media> =
	TileThumbnailProps & { media: TMedia; sourceRootPath?: string };

export type MediaGridLinkProps = {
	children: JSX.Element;
	class: string;
	"data-media-id": string;
	href: string;
	"aria-current"?:
		| "date"
		| "false"
		| "location"
		| "page"
		| "step"
		| "time"
		| "true";
	"aria-pressed"?: boolean;
	onClick?: (event: MouseEvent) => void;
	onContextMenu: (event: MouseEvent) => void;
};

type MediaTileStyleProps = {
	imageLoadPolicy?: MediaGridImageLoadPolicy;
	priority?: boolean;
	onContextMenu?: (event: MouseEvent) => void;
	linkComponent: (props: MediaGridLinkProps) => JSX.Element;
	class?: string;
	thumbnailClass?: string;
	overlayClass?: string;
	isBulkSelectMode?: boolean;
	isPreviewSelected?: boolean;
	isSelected?: boolean;
};

type MediaGridItemProps<TMedia extends MediaGridMedia> = MediaTileStyleProps & {
	media: TMedia;
	linkPrefix?: string;
	sourceRootPath?: string;
	canRenderThumbnail?: (media: TMedia) => boolean;
	renderThumbnail: (props: MediaGridThumbnailProps<TMedia>) => JSX.Element;
};

export function MediaGridItem<TMedia extends MediaGridMedia>(
	props: MediaGridItemProps<TMedia>,
) {
	const href = () =>
		props.linkPrefix
			? `${props.linkPrefix}/${props.media.id}`
			: `/sources/${props.media.mediaSourceId}/${props.media.id}`;
	const canRenderThumbnail = () =>
		props.canRenderThumbnail?.(props.media) ??
		props.media.mediaType !== "audio";

	return (
		<MediaGridTile
			{...props}
			id={props.media.id}
			href={href()}
			title={props.media.fileName}
			width={props.media.width}
			height={props.media.height}
			hasThumbnail={canRenderThumbnail()}
			fallbackLabel={props.media.mediaType}
			renderThumbnail={(thumbnail) =>
				props.renderThumbnail(
					mergeProps(thumbnail, {
						get media() {
							return props.media;
						},
						get sourceRootPath() {
							return props.sourceRootPath;
						},
					}),
				)
			}
		/>
	);
}

/** A collection tile can link to a library item or an external provider's detail route. */
export function MediaGridTile(
	props: MediaTileStyleProps & {
		id: string;
		href: string;
		title: string;
		info?: string;
		width?: number | null;
		height?: number | null;
		hasThumbnail: boolean;
		fallbackLabel: string;
		renderThumbnail: (props: TileThumbnailProps) => JSX.Element;
	},
) {
	const LinkComponent = props.linkComponent;

	return (
		<LinkComponent
			class={cn(
				"group relative block aspect-landscape overflow-hidden rounded-md bg-muted outline-none ring-offset-2 ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring",
				(props.isSelected || props.isPreviewSelected) && "ring-2 ring-ring",
				props.class,
			)}
			data-media-id={props.id}
			href={props.href}
			aria-current={props.isPreviewSelected ? "true" : undefined}
			aria-pressed={props.isSelected}
			onClick={undefined}
			onContextMenu={(event) => props.onContextMenu?.(event)}
		>
			<Show when={props.isBulkSelectMode || Boolean(props.isSelected)}>
				<div class="absolute top-2 right-2 z-10 flex size-6 items-center justify-center">
					<span
						aria-hidden="true"
						class="flex size-6 items-center justify-center rounded-full border border-white bg-black/55 font-bold text-white text-xs shadow-sm"
					>
						{props.isSelected ? "✓" : ""}
					</span>
				</div>
			</Show>

			<Show
				fallback={
					<div class="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
						{props.fallbackLabel}
					</div>
				}
				when={props.hasThumbnail}
			>
				{props.renderThumbnail({
					alt: props.title,
					class: cn(
						"h-full w-full object-cover",
						"transition duration-200 group-hover:scale-105 motion-reduce:transition-none",
						props.thumbnailClass,
					),
					height: props.height,
					get enabled() {
						return props.imageLoadPolicy?.enabled;
					},
					get fetchpriority() {
						return props.imageLoadPolicy?.fetchpriority;
					},
					get loading() {
						return (
							props.imageLoadPolicy?.loading ??
							(props.priority ? "eager" : "lazy")
						);
					},
					sizes: MEDIA_GRID_IMAGE_SIZES,
					width: props.width,
				})}
			</Show>

			<div
				class={cn(
					"absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity",
					"group-focus-within:opacity-100 group-hover:opacity-100",
					props.overlayClass,
				)}
			>
				<p class="truncate font-medium text-white text-xs" title={props.title}>
					{props.title}
				</p>
				<Show when={props.info}>
					<p class="truncate text-white text-xs">{props.info}</p>
				</Show>
			</div>
		</LinkComponent>
	);
}
