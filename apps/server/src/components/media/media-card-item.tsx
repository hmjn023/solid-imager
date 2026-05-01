import type { Media } from "@solid-imager/core/domain/media/schemas";
import { MediaCardItem as SharedMediaCardItem } from "@solid-imager/ui/media-card-item";
import { ThumbnailImage } from "~/components/media/thumbnail-image";

type MediaCardItemProps = {
	media: Media;
	/**
	 * If true, a checkbox will be displayed for selection.
	 */
	selectable?: boolean;
	/**
	 * Whether the item is currently selected.
	 */
	selected?: boolean;
	/**
	 * Callback when selection is toggled.
	 */
	onToggle?: (id: string) => void;
	/**
	 * Optional priority loading for the image.
	 */
	priority?: boolean;
};

export function MediaCardItem(props: MediaCardItemProps) {
	return (
		<SharedMediaCardItem
			class="shadow shadow-lg"
			dimensionSeparator="×"
			isSelected={props.selected}
			linkComponent={(linkProps) => <a {...linkProps} />}
			media={props.media}
			onSelect={props.onToggle}
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
			selectable={props.selectable}
		/>
	);
}
