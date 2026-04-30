import type { Media } from "@solid-imager/core/domain/media/schemas";
import { MediaCardItem as SharedMediaCardItem } from "@solid-imager/ui/media-card-item";
import { ThumbnailImage } from "./thumbnail-image";

type MediaCardItemProps = {
	media: Media;
	selectable?: boolean;
	selected?: boolean;
	onToggle?: (id: string) => void;
	sourceRootPath?: string;
};

export function MediaCardItem(props: MediaCardItemProps) {
	return (
		<SharedMediaCardItem
			canRenderThumbnail={(media) => media.mediaType === "image"}
			checkboxContainerClass="rounded bg-background/90 p-1"
			isSelected={props.selected}
			media={props.media}
			onSelect={props.onToggle}
			renderThumbnail={(thumbnailProps) => (
				<ThumbnailImage
					alt={thumbnailProps.alt}
					class="h-full w-full object-cover"
					media={thumbnailProps.media}
					sourceRootPath={thumbnailProps.sourceRootPath}
				/>
			)}
			selectable={props.selectable}
			sourceRootPath={props.sourceRootPath}
			thumbnailContainerClass="bg-muted text-muted-foreground"
		/>
	);
}
