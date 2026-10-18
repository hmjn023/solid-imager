import type {
	ProcessingRecoveryRequest,
	ProcessingRecoveryResponse,
	ProcessingRecoveryReason,
} from "@solid-imager/core/domain/processing/schemas";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";

export type ProcessingRecoveryApi = {
	scanRecovery(
		input: ProcessingRecoveryRequest,
		signal: AbortSignal,
	): Promise<ProcessingRecoveryResponse>;
	enqueueRecovery(
		input: ProcessingRecoveryRequest,
		signal: AbortSignal,
	): Promise<ProcessingRecoveryResponse>;
	listSources(): Promise<Pick<SafeMediaSource, "id" | "name" | "type">[]>;
};
export type RecoveryProgress = {
	scanned: number;
	matched: number;
	queued: number;
	batches: number;
	reasons: Record<ProcessingRecoveryReason, number>;
	samples: ProcessingRecoveryResponse["items"];
};
export function emptyRecoveryProgress(): RecoveryProgress {
	return {
		scanned: 0,
		matched: 0,
		queued: 0,
		batches: 0,
		reasons: {
			not_requested: 0,
			failed: 0,
			outdated: 0,
			missing_output: 0,
			abandoned: 0,
		},
		samples: [],
	};
}
/** Bounded continuation, including empty pages; never retain every target ID. */
export async function runProcessingRecovery(
	requestPage: (
		input: ProcessingRecoveryRequest,
		signal: AbortSignal,
	) => Promise<ProcessingRecoveryResponse>,
	scope: Omit<ProcessingRecoveryRequest, "cursor">,
	signal: AbortSignal,
	onProgress: (progress: RecoveryProgress) => void,
) {
	let cursor: ProcessingRecoveryRequest["cursor"];
	let progress = emptyRecoveryProgress();
	for (;;) {
		signal.throwIfAborted();
		const page = await requestPage({ ...scope, cursor }, signal);
		const reasons = { ...progress.reasons };
		for (const item of page.items) reasons[item.reason]++;
		progress = {
			scanned: progress.scanned + page.scanned,
			matched: progress.matched + page.items.length,
			queued: progress.queued + page.queued,
			batches: progress.batches + (page.jobId ? 1 : 0),
			reasons,
			samples: [...progress.samples, ...page.items].slice(0, 10),
		};
		onProgress(progress);
		if (!page.cursor) return progress;
		if (
			cursor &&
			(cursor.before !== page.cursor.before ||
				page.cursor.afterId <= cursor.afterId)
		)
			throw new Error("Processing scan cursor did not advance");
		cursor = page.cursor;
	}
}
