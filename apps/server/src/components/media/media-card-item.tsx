import type { MediaSafe } from "@solid-imager/core/domain/media/schemas";
import { MediaCardItem as SharedMediaCardItem } from "@solid-imager/ui/media-card-item";
import { Link } from "@tanstack/solid-router";
import { ThumbnailImage } from "./thumbnail-image";

type MediaCardItemProps = {
	media: MediaSafe;
	selectable?: boolean;
	selected?: boolean;
	onToggle?: (id: string) => void;
	sourceRootPath?: string;
};

export function MediaCardItem(props: MediaCardItemProps) {
	return (
		<SharedMediaCardItem
			isSelected={props.selected}
			linkComponent={(linkProps) => (
				<Link
					class={linkProps.class}
					onClick={linkProps.onClick}
					params={{
						mediaId: props.media.id,
						mediaSourceId: props.media.mediaSourceId,
					}}
					to="/sources/$mediaSourceId/$mediaId"
				>
					{linkProps.children}
				</Link>
			)}
			media={props.media}
			onSelect={props.onToggle}
			renderThumbnail={(thumbnailProps) => (
				<ThumbnailImage
					alt={thumbnailProps.alt}
					class={thumbnailProps.class}
					height={thumbnailProps.height}
					loading={thumbnailProps.loading}
					media={thumbnailProps.media}
					sourceRootPath={thumbnailProps.sourceRootPath}
					width={thumbnailProps.width}
				/>
			)}
			selectable={props.selectable}
			sourceRootPath={props.sourceRootPath}
		/>
	);
}
