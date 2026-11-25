import type { ImportEvent } from "@solid-imager/core/events";
import type { SafeMediaSource } from "@solid-imager/core/sources";
import type {
	DanbooruImportPreview,
	PendingImportJob,
	PixivImportPreview,
} from "./import-review-modal.types";

export type ImportEventHandler = (event: ImportEvent) => void | Promise<void>;
export type ImportEventConnectedHandler = () => void | Promise<void>;

export type PendingDownloadsIndicatorProps = {
	countPending: () => Promise<number>;
	danbooruPreview?: DanbooruImportPreview;
	pixivPreview?: PixivImportPreview;
	listPending: () => Promise<PendingImportJob[]>;
	listSources: () => Promise<SafeMediaSource[]>;
	processPending: (
		jobIds: string[],
		targetSourceId: string,
	) => Promise<{ success: boolean; processedCount: number }>;
	cancelPending: (jobIds: string[]) => Promise<{ success: boolean }>;
	subscribeImportEvents: (
		handler: ImportEventHandler,
		onConnected?: ImportEventConnectedHandler,
	) => Promise<(() => void) | undefined> | (() => void) | undefined;
};
