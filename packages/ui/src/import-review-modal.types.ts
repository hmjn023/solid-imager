import type { DownloadItem } from "@solid-imager/core/domain/media/schemas";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";

export type PendingImportJob = {
	id: string;
	item: DownloadItem;
	createdAt: Date | string;
	targetSourceId?: string;
};

export type ImportReviewModalProps = {
	isOpen: boolean;
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
