import type { Media } from "@solid-imager/core/domain/media/schemas";
import { MediaGridItem as SharedMediaGridItem } from "@solid-imager/ui/media-grid-item";
import { Link } from "@tanstack/solid-router";
import { ThumbnailImage } from "./thumbnail-image";

type MediaGridItemProps = {
	linkPrefix?: string;
	media: Media;
	onContextMenu?: (event: MouseEvent) => void;
	priority?: boolean;
	sourceRootPath?: string;
	isBulkSelectMode?: boolean;
	isSelected?: boolean;
	onToggleSelect?: () => void;
};

export function MediaGridItem(props: MediaGridItemProps) {
	return (
		<SharedMediaGridItem
			isBulkSelectMode={props.isBulkSelectMode}
			isSelected={props.isSelected}
			linkComponent={(linkProps) => {
				if (props.isBulkSelectMode) {
					return (
						<button
							type="button"
							class={linkProps.class}
							data-media-id={linkProps["data-media-id"]}
							onContextMenu={linkProps.onContextMenu}
							onClick={(e) => {
								e.preventDefault();
								props.onToggleSelect?.();
							}}
						>
							{linkProps.children}
						</button>
					);
				}
				return (
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
			}}
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
					media={thumbnailProps.media}
					sourceRootPath={thumbnailProps.sourceRootPath}
					width={thumbnailProps.width}
				/>
			)}
			sourceRootPath={props.sourceRootPath}
		/>
	);
}
