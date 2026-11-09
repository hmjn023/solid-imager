import { createMemo } from "solid-js";
import { MediaGridTile } from "../media-grid-item";
import { isPlainPrimaryClick } from "../media-grid-item-link";
import { HIGH_PRIORITY_THUMBNAILS, MediaTileGrid } from "../media-tile-grid";
import { ThumbnailImage } from "../thumbnail-image";

export type ViewerGridItemDescription = {
	title: string;
	info: string;
	thumbnail: string | null;
	width?: number;
	height?: number;
};

type ViewerResultsGridProps<T extends { id: number }> = {
	posts: readonly T[];
	describe: (post: T) => ViewerGridItemDescription;
	postHref: (id: number) => string;
	onOpenPost: (id: number) => void;
};

export function ViewerResultsGrid<T extends { id: number }>(
	props: ViewerResultsGridProps<T>,
) {
	return (
		<div class="@container min-w-0">
			<MediaTileGrid items={props.posts} eagerCount={HIGH_PRIORITY_THUMBNAILS}>
				{(post, imageLoadPolicy) => {
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
							fallbackLabel="プレビューなし"
							overlayClass="opacity-100"
							linkComponent={(link) => (
								<a
									class={link.class}
									data-media-id={link["data-media-id"]}
									href={link.href}
									aria-label={item().title + " を開く"}
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
									fallback="プレビューなし"
									source={{ getUrl: () => item().thumbnail ?? "" }}
								/>
							)}
						/>
					);
				}}
			</MediaTileGrid>
		</div>
	);
}
