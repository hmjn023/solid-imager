import {
	type MediaGridImageLoadPolicy,
	type MediaGridLinkProps,
	V2MediaGridItem as SharedV2MediaGridItem,
} from "@solid-imager/ui/v2-media-grid-item";
import { Link, useLocation } from "@tanstack/solid-router";
import { Show } from "solid-js";
import type { ServerMediaGridItemProps } from "./legacy-media-grid-item";
import { ThumbnailImage } from "./thumbnail-image";

export type V2ServerMediaGridItemProps = Omit<
	ServerMediaGridItemProps,
	"imageLoadPolicy"
> & {
	imageLoadPolicy?: MediaGridImageLoadPolicy;
};

export function V2MediaGridItem(props: V2ServerMediaGridItemProps) {
	const location = useLocation();
	const detailLink = (linkProps: MediaGridLinkProps) => (
		<Link
			class={linkProps.class}
			data-media-id={linkProps["data-media-id"]}
			onClick={(event: MouseEvent) => {
				if (
					props.onPreviewSelect &&
					window.matchMedia("(min-width: 1536px)").matches
				) {
					event.preventDefault();
					props.onPreviewSelect();
					return;
				}
				if (
					event.button === 0 &&
					!event.metaKey &&
					!event.ctrlKey &&
					!event.shiftKey &&
					!event.altKey
				) {
					sessionStorage.setItem("v2:media-return", location().href);
				}
			}}
			onContextMenu={linkProps.onContextMenu}
			params={{
				mediaId: props.media.id,
				mediaSourceId: props.media.mediaSourceId,
			}}
			to="/v2/sources/$mediaSourceId/$mediaId"
		>
			{linkProps.children}
		</Link>
	);

	return (
		<SharedV2MediaGridItem
			isBulkSelectMode={props.isBulkSelectMode}
			isSelected={props.isSelected}
			imageLoadPolicy={props.imageLoadPolicy}
			linkComponent={(linkProps) => (
				<Show fallback={detailLink(linkProps)} when={props.isBulkSelectMode}>
					<button
						aria-pressed={props.isSelected}
						class={linkProps.class}
						data-media-id={linkProps["data-media-id"]}
						onClick={(event) => {
							event.preventDefault();
							props.onToggleSelect?.();
						}}
						onContextMenu={linkProps.onContextMenu}
						type="button"
					>
						{linkProps.children}
					</button>
				</Show>
			)}
			linkPrefix={props.linkPrefix}
			media={props.media}
			onContextMenu={props.onContextMenu}
			priority={props.priority}
			renderThumbnail={(thumbnailProps) => (
				<ThumbnailImage
					alt={thumbnailProps.alt}
					class={thumbnailProps.class}
					enabled={thumbnailProps.enabled}
					fetchpriority={thumbnailProps.fetchpriority}
					height={thumbnailProps.height}
					loading={thumbnailProps.loading}
					media={thumbnailProps.media}
					sizes={thumbnailProps.sizes}
					sourceRootPath={thumbnailProps.sourceRootPath}
					width={thumbnailProps.width}
				/>
			)}
			sourceRootPath={props.sourceRootPath}
		/>
	);
}
