import type { Media } from "@solid-imager/core/domain/media/schemas";
import { MediaGridItem as SharedMediaGridItem } from "@solid-imager/ui/media-grid-item";
import { ThumbnailImage } from "~/components/media/thumbnail-image";

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
	return (
		<SharedMediaGridItem
			linkComponent={(linkProps) => <a {...linkProps} />}
			linkPrefix={props.linkPrefix}
			media={props.media}
			onContextMenu={props.onContextMenu}
			priority={props.priority}
			renderThumbnail={(thumbnailProps) => (
				<ThumbnailImage
					alt={thumbnailProps.alt}
					class={thumbnailProps.class}
					height={thumbnailProps.height}
					loading={thumbnailProps.loading}
					mediaId={thumbnailProps.media.id}
					mediaSourceId={thumbnailProps.media.mediaSourceId}
					modifiedAt={thumbnailProps.media.modifiedAt}
					width={thumbnailProps.width}
				/>
			)}
		/>
	);
}
