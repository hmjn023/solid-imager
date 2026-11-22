import type { DanbooruPost } from "@solid-imager/core/danbooru";
import type { DownloadItem } from "@solid-imager/core/media";
import type { SafeMediaSource } from "@solid-imager/core/sources";

export type PendingImportJob = {
	id: string;
	item: DownloadItem;
	createdAt: Date | string;
	targetSourceId?: string;
};

export type PixivImportPreview = {
	apiBase: () => string;
	loadPoster: (id: number) => Promise<string | undefined>;
};

export type DanbooruImportPreview = {
	apiBase: () => string;
	loadPost: (
		id: number,
	) => Promise<Pick<DanbooruPost, "fileUrl" | "previewUrl">>;
};

export type ImportReviewModalProps = {
	isOpen: boolean;
	pixivPreview?: PixivImportPreview;
	danbooruPreview?: DanbooruImportPreview;
	onClose: () => void;
	onImportCompleted: () => void;
	listPending: () => Promise<PendingImportJob[]>;
	listSources: () => Promise<SafeMediaSource[]>;
	processPending: (
		jobIds: string[],
		targetSourceId: string,
	) => Promise<{ success: boolean; processedCount: number }>;
	cancelPending: (jobIds: string[]) => Promise<{ success: boolean }>;
};
