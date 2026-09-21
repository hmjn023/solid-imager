import type { Media } from "@solid-imager/core/domain/media/schemas";
import {
	type MediaGridImageLoadPolicy,
	type MediaGridLinkProps,
	MediaGridItem as SharedMediaGridItem,
} from "@solid-imager/ui/media-grid-item";
import { MediaGridItemLink } from "@solid-imager/ui/media-grid-item-link";
import { ThumbnailImage } from "./thumbnail-image";

export type TauriMediaGridItemProps = {
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
	onOpenMediaDetail?: () => void;
};

export function MediaGridItem(props: TauriMediaGridItemProps) {
	return (
		<SharedMediaGridItem
			isBulkSelectMode={props.isBulkSelectMode}
			isPreviewSelected={props.isPreviewSelected}
			isSelected={props.isSelected}
			imageLoadPolicy={props.imageLoadPolicy}
			linkComponent={(linkProps: MediaGridLinkProps) => (
				<MediaGridItemLink
					isBulkSelectMode={props.isBulkSelectMode}
					isSelected={props.isSelected}
					linkProps={linkProps}
					media={props.media}
					onOpenMediaDetail={props.onOpenMediaDetail}
					onPrepareMediaDetail={props.onPrepareMediaDetail}
					onPreviewSelect={props.onPreviewSelect}
					onSelectGesture={props.onSelectGesture}
					onToggleSelect={props.onToggleSelect}
				>
					{linkProps.children}
				</MediaGridItemLink>
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
