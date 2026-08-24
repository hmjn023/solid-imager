import {
	type MediaGridImageLoadPolicy,
	type MediaGridLinkProps,
	V2MediaGridItem as SharedV2MediaGridItem,
} from "@solid-imager/ui/v2-media-grid-item";
import { Link } from "@tanstack/solid-router";
import { Show } from "solid-js";
import type { ServerMediaGridItemProps } from "./legacy-media-grid-item";
import { ThumbnailImage } from "./thumbnail-image";

export type V2ServerMediaGridItemProps = Omit<
	ServerMediaGridItemProps,
	"imageLoadPolicy"
> & {
	imageLoadPolicy?: MediaGridImageLoadPolicy;
	onOpenMediaDetail?: () => void;
};

export function V2MediaGridItem(props: V2ServerMediaGridItemProps) {
	const isPlainPrimaryClick = (event: MouseEvent) =>
		event.button === 0 &&
		!event.metaKey &&
		!event.ctrlKey &&
		!event.shiftKey &&
		!event.altKey;
	const hasFinePointer = () => window.matchMedia("(pointer: fine)").matches;
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
			onClick={(event: MouseEvent) => {
				if (
					props.onSelectGesture &&
					hasFinePointer() &&
					isModifiedSelectionClick(event)
				) {
					event.preventDefault();
					props.onSelectGesture(event);
					return;
				}
				if (!isPlainPrimaryClick(event)) return;

				if (props.onPreviewSelect && hasFinePointer()) {
					event.preventDefault();
					props.onPreviewSelect();
					return;
				}

				props.onPrepareMediaDetail?.();
			}}
			onContextMenu={linkProps.onContextMenu}
			onDblClick={(event: MouseEvent) => {
				if (
					!isPlainPrimaryClick(event) ||
					!hasFinePointer() ||
					!props.onOpenMediaDetail
				) {
					return;
				}

				event.preventDefault();
				props.onPrepareMediaDetail?.();
				props.onOpenMediaDetail();
			}}
			onKeyDown={(event: KeyboardEvent) => {
				if (
					event.key === "Enter" &&
					!event.metaKey &&
					!event.ctrlKey &&
					!event.shiftKey &&
					!event.altKey &&
					props.onOpenMediaDetail
				) {
					event.preventDefault();
					props.onPrepareMediaDetail?.();
					props.onOpenMediaDetail();
					return;
				}

				if (event.key === " " && props.onPreviewSelect) {
					event.preventDefault();
					props.onPreviewSelect();
				}
			}}
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
			isPreviewSelected={props.isPreviewSelected}
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
