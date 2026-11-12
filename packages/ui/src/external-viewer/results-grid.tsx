import { t } from "@solid-imager/i18n";
import { createMemo } from "solid-js";
import { MediaGridTile } from "../media-grid-item";
import { isPlainPrimaryClick } from "../media-grid-item-link";
import {
	HIGH_PRIORITY_THUMBNAILS,
	MediaTileGrid,
	type MediaGridAnchor,
	type MediaGridHandle,
} from "../media-tile-grid";
import { ThumbnailImage } from "../thumbnail-image";

export type ViewerGridItemDescription = {
	title: string;
	info: string;
	thumbnail: string | null;
	width?: number;
	height?: number;
};

export type ViewerGridAnchor = MediaGridAnchor<number>;
export type ViewerGridHandle = Pick<
	MediaGridHandle<number>,
	"getAnchor" | "restoreAnchor"
> & {
	focusPost(id: number): Promise<boolean>;
};

type ViewerResultsGridProps<T extends { id: number }> = {
	posts: readonly T[];
	describe: (post: T) => ViewerGridItemDescription;
	postHref: (id: number) => string;
	onOpenPost: (id: number) => void;
	onGridReady?: (handle: ViewerGridHandle | undefined) => void;
};

export function ViewerResultsGrid<T extends { id: number }>(
	props: ViewerResultsGridProps<T>,
) {
	return (
		<MediaTileGrid
			items={props.posts}
			eagerCount={HIGH_PRIORITY_THUMBNAILS}
			enableVirtualization
			itemAspectRatio={4 / 3}
			scrollMode="element"
			onReady={(handle) =>
				props.onGridReady?.(
					handle && {
						getAnchor: handle.getAnchor,
						restoreAnchor: handle.restoreAnchor,
						focusPost: handle.focusItem,
					},
				)
			}
			renderItem={(post, imageLoadPolicy) => {
				const item = createMemo(() => props.describe(post));
				return (
					<MediaGridTile
						id={String(post.id)}
						title={item().title}
						info={item().info}
						width={item().width}
						height={item().height}
						href={props.postHref(post.id)}
						hasThumbnail={!!item().thumbnail}
						imageLoadPolicy={imageLoadPolicy}
						fallbackLabel={t("importReviewModal.noPreview")}
						overlayClass="opacity-100"
						linkComponent={(link) => (
							<a
								class={link.class}
								data-media-id={link["data-media-id"]}
								href={link.href}
								aria-label={item().title + t("resultsGrid.open")}
								onClick={(event) => {
									if (!isPlainPrimaryClick(event)) return;
									event.preventDefault();
									props.onOpenPost(post.id);
								}}
							>
								{link.children}
							</a>
						)}
						renderThumbnail={(thumbnail) => (
							<ThumbnailImage
								{...thumbnail}
								referrerPolicy="no-referrer"
								fallback={t("importReviewModal.noPreview")}
								source={{ getUrl: () => item().thumbnail ?? "" }}
							/>
						)}
					/>
				);
			}}
		/>
	);
}
