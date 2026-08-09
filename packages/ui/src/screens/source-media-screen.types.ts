import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { Component, JSX } from "solid-js";
import type {
	UploadOptions,
	UseSourceMediaPageResult,
} from "../hooks/use-source-media-page";
import type { MediaGridImageLoadPolicy } from "../media-grid-item";

/** Presentation contract shared by source-media workspaces. */
export type SourceMediaScreenProps = {
	enableVirtualization?: boolean;
	isBulkSelectMode?: () => boolean;
	isSelected?: (mediaId: string) => boolean;
	mediaSourceName?: () => string | undefined;
	moveCopyDialogComponent: Component<{
		currentSourceId: string;
		mode: "copy" | "move";
		onConfirm: (targetSourceId: string) => void;
		onOpenChange: (open: boolean) => void;
		open: boolean;
	}>;
	onBulkAction?: () => void;
	onClearSelection?: () => void;
	onEnterBulkSelectMode?: () => void;
	onOpenMediaDetail?: (media: Media) => void;
	onRetryFilters: () => void | Promise<void>;
	onToggleSelect?: (mediaId: string) => void;
	page: UseSourceMediaPageResult;
	renderActions: (props: { onOpenMobileFilters: () => void }) => JSX.Element;
	renderItem: (
		media: Media,
		options: {
			imageLoadPolicy?: MediaGridImageLoadPolicy;
			isBulkSelectMode?: boolean;
			isPreviewSelected?: boolean;
			isSelected?: boolean;
			onContextMenu: () => void;
			onPreviewSelect?: () => void;
			priority?: boolean;
		},
	) => JSX.Element;
	renderJobProgress?: (props: {
		jobProgress: () =>
			| import("@solid-imager/core/domain/sources/events").JobProgressEvent
			| null;
	}) => JSX.Element;
	renderMediaPreview?: (media: Media) => JSX.Element;
	selectedCount?: () => number;
	showOpenInNewTab?: boolean;
	uploadModalComponent: Component<{
		initialFile: File | null;
		isOpen: boolean;
		onClose: () => void;
		onUpload: (options: UploadOptions) => Promise<void>;
		onUrlFetch: (file: File) => void;
		pastedUrl: string | null;
	}>;
};
