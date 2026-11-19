import type { SimilarityModel } from "@solid-imager/core/search";
import type { Media } from "@solid-imager/core/media";
import type { Component, JSX } from "solid-js";
import type { MediaCollectionSelectionMode } from "../hooks/use-media-collection-selection";
import type {
	UploadOptions,
	UseSourceMediaPageResult,
} from "../hooks/use-source-media-page";
import type { MediaGridImageLoadPolicy } from "../media-grid-item";
import type { MoveCopyMediaDialogProps } from "../move-copy-media-dialog";

/** Presentation contract shared by source-media workspaces. */
export type SourceMediaScreenProps = {
	detailBasePath?: string;
	enableVirtualization?: boolean;
	isBulkSelectMode?: () => boolean;
	isSelected?: (mediaId: string) => boolean;
	mediaSourceName?: () => string | undefined;
	moveCopyDialogComponent: Component<
		Omit<MoveCopyMediaDialogProps, "listSources">
	>;
	onBulkAction?: () => void;
	onClearSelection?: () => void;
	onEnterBulkSelectMode?: () => void;
	onFindSimilar?: (media: Media, model?: SimilarityModel) => void;
	onOpenMediaDetail?: (media: Media, context?: Media[]) => void;
	onPrepareMediaDetail?: (media: Media, context?: Media[]) => void;
	onRetryFilters: () => void | Promise<void>;
	onSelectAll?: () => void;
	onSelectMedia?: (mediaId: string, mode: MediaCollectionSelectionMode) => void;
	onToggleSelect?: (mediaId: string) => void;
	page: UseSourceMediaPageResult;
	renderItem: (
		media: Media,
		options: {
			imageLoadPolicy?: MediaGridImageLoadPolicy;
			isBulkSelectMode?: boolean;
			isPreviewSelected?: boolean;
			isSelected?: boolean;
			onContextMenu: () => void;
			onOpenMediaDetail?: () => void;
			onPrepareMediaDetail?: () => void;
			onPreviewSelect?: () => void;
			onSelectGesture?: (event: MouseEvent | KeyboardEvent) => void;
			onToggleSelect?: () => void;
			priority?: boolean;
		},
	) => JSX.Element;
	renderJobProgress?: (props: {
		jobProgress: () =>
			| import("@solid-imager/core/events").JobProgressEvent
			| null;
	}) => JSX.Element;
	renderMediaPreview?: (media: Media) => JSX.Element;
	selectedCount?: () => number;
	showOpenInNewTab?: boolean;
	uploadModalComponent: Component<{
		sourceId?: string;
		initialFile: File | null;
		isOpen: boolean;
		onClose: () => void;
		onUpload: (options: UploadOptions) => Promise<void>;
		pastedUrl: string | null;
	}>;
};
