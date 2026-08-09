import type { ImportEvent } from "@solid-imager/core/domain/sources/events";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import type { PendingImportJob } from "./import-review-modal.types";

export type ImportEventHandler = (event: ImportEvent) => void | Promise<void>;
export type ImportEventConnectedHandler = () => void | Promise<void>;

export type PendingDownloadsIndicatorProps = {
	countPending: () => Promise<number>;
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
