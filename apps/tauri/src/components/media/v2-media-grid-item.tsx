import type { Media } from "@solid-imager/core/domain/media/schemas";
import {
	type MediaGridImageLoadPolicy,
	type MediaGridLinkProps,
	V2MediaGridItem as SharedV2MediaGridItem,
} from "@solid-imager/ui/v2-media-grid-item";
import { Link } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { ThumbnailImage } from "./thumbnail-image";

export type TauriV2MediaGridItemProps = {
	media: Media;
	imageLoadPolicy?: MediaGridImageLoadPolicy;
	isBulkSelectMode?: boolean;
	isPreviewSelected?: boolean;
	isSelected?: boolean;
	onContextMenu?: (event: MouseEvent) => void;
	onOpenMediaDetail?: () => void;
	onPrepareMediaDetail?: () => void;
	onPreviewSelect?: () => void;
	onSelectGesture?: (event: MouseEvent) => void;
	onToggleSelect?: () => void;
	priority?: boolean;
	sourceRootPath?: string;
};

export function V2MediaGridItem(props: TauriV2MediaGridItemProps) {
	const isPlainPrimaryClick = (event: MouseEvent) =>
		event.button === 0 &&
		!event.metaKey &&
		!event.ctrlKey &&
		!event.shiftKey &&
		!event.altKey;
	const isModifiedSelectionClick = (event: MouseEvent) =>
		event.button === 0 &&
		!event.altKey &&
		(event.metaKey || event.ctrlKey || event.shiftKey);

	const detailLink = (linkProps: MediaGridLinkProps) => (
		<Link
			aria-current={linkProps["aria-current"]}
			aria-pressed={linkProps["aria-pressed"]}
			class={linkProps.class}
			data-media-id={linkProps["data-media-id"]}
			onClick={(event) => {
				if (props.onSelectGesture && isModifiedSelectionClick(event)) {
					event.preventDefault();
					props.onSelectGesture(event);
					return;
				}
				if (!isPlainPrimaryClick(event)) return;
				if (props.onPreviewSelect) {
					event.preventDefault();
					props.onPreviewSelect();
					return;
				}
				props.onPrepareMediaDetail?.();
			}}
			onContextMenu={linkProps.onContextMenu}
			onDblClick={(event) => {
				if (!isPlainPrimaryClick(event) || !props.onOpenMediaDetail) return;
				event.preventDefault();
				props.onPrepareMediaDetail?.();
				props.onOpenMediaDetail();
			}}
			onKeyDown={(event) => {
				if (event.key === "Enter" && props.onOpenMediaDetail) {
					event.preventDefault();
					props.onPrepareMediaDetail?.();
					props.onOpenMediaDetail();
				}
			}}
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
		<SharedV2MediaGridItem
			imageLoadPolicy={props.imageLoadPolicy}
			isBulkSelectMode={props.isBulkSelectMode}
			isPreviewSelected={props.isPreviewSelected}
			isSelected={props.isSelected}
			linkComponent={(linkProps) => (
				<Show fallback={detailLink(linkProps)} when={props.isBulkSelectMode}>
					<button
						aria-pressed={props.isSelected}
						class={linkProps.class}
						data-media-id={linkProps["data-media-id"]}
						onClick={(event) => {
							event.preventDefault();
							if (props.onSelectGesture && isModifiedSelectionClick(event)) {
								props.onSelectGesture(event);
								return;
							}
							props.onToggleSelect?.();
						}}
						onContextMenu={linkProps.onContextMenu}
						type="button"
					>
						{linkProps.children}
					</button>
				</Show>
			)}
			linkPrefix={undefined}
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
