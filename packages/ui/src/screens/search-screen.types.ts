import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import type {
	SearchPageFilterData,
	UseSearchPageResult,
} from "../hooks/use-search-page";
import type { SourceMediaPagePresetClient } from "../hooks/use-source-media-page";
import type { MediaGridImageLoadPolicy } from "../media-grid-item";

export type SearchMediaItemOptions = {
	imageLoadPolicy?: MediaGridImageLoadPolicy;
	isBulkSelectMode?: boolean;
	isSelected?: boolean;
	isPreviewSelected?: boolean;
	onOpenMediaDetail?: () => void;
	onPrepareMediaDetail?: () => void;
	onPreviewSelect?: () => void;
	onSelectGesture?: (event: MouseEvent | KeyboardEvent) => void;
	onToggleSelect?: () => void;
	priority?: boolean;
};

/** Data and actions shared by the legacy and v2 search presentations. */
export type SearchWorkspaceProps = {
	enableVirtualization?: boolean;
	filterData: SearchPageFilterData;
	onFindSimilar?: (media: Media) => void;
	onSelectSource: (id: string) => void;
	page: UseSearchPageResult;
	presetClient: SourceMediaPagePresetClient;
	renderMediaItem: (
		media: Media,
		options?: SearchMediaItemOptions,
	) => import("solid-js").JSX.Element;
	selectedSource: string | null;
	sources: SafeMediaSource[] | undefined;
	ssrGuard?: boolean;
};
