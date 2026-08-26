import type { Media } from "@solid-imager/core/domain/media/schemas";
import {
	type MediaGridImageLoadPolicy,
	type MediaGridLinkProps,
	MediaGridItem as SharedMediaGridItem,
} from "@solid-imager/ui/media-grid-item";
import { Link } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { ThumbnailImage } from "./thumbnail-image";

export type ServerMediaGridItemProps = {
	linkPrefix?: string;
	media: Media;
	imageLoadPolicy?: MediaGridImageLoadPolicy;
	onContextMenu?: (event: MouseEvent) => void;
	priority?: boolean;
	sourceRootPath?: string;
	isBulkSelectMode?: boolean;
	isPreviewSelected?: boolean;
	isSelected?: boolean;
	onToggleSelect?: () => void;
	onPrepareMediaDetail?: () => void;
	onPreviewSelect?: () => void;
	onSelectGesture?: (event: MouseEvent | KeyboardEvent) => void;
};

export function LegacyMediaGridItem(props: ServerMediaGridItemProps) {
	const detailLink = (linkProps: MediaGridLinkProps) => (
		<Link
			class={linkProps.class}
			data-media-id={linkProps["data-media-id"]}
			onContextMenu={linkProps.onContextMenu}
			params={{
				mediaId: props.media.id,
				mediaSourceId: props.media.mediaSourceId,
			}}
			to="/sources/$mediaSourceId/$mediaId"
		>
			{linkProps.children}
		</Link>
	);

	return (
		<SharedMediaGridItem
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
