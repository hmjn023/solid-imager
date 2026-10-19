import type {
	Transaction,
	TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	BatchAttemptLostError,
	batchInputSchema,
	safeBatchRunSchema,
	type BatchInput,
	type BatchClaim,
	type BatchItem,
} from "@solid-imager/core/domain/batches/schemas";
import type {
	IBatchRunRepository,
	BatchSummary,
	BatchTarget,
} from "@solid-imager/core/domain/repositories/batch-run-repository";
import type { MediaProcessingState } from "@solid-imager/core/domain/processing/schemas";
import type { ILogger } from "../ports/media-service";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";

export type BatchCapture = (
	cursor: string | undefined,
	tx: Transaction,
) => Promise<{ targets: BatchTarget[]; nextCursor?: string }>;
export type BatchRunServiceDeps = {
	repo: IBatchRunRepository;
	transactions: TransactionManager;
	capture: (input: BatchInput) => BatchCapture;
	reserve: (
		item: BatchItem,
		input: BatchInput,
		tx: Transaction,
	) => Promise<MediaProcessingState | null>;
	notify: (
		summary: BatchSummary,
		action?: "retry" | "cancel" | "progress",
	) => void;
	logger: ILogger;
};
class ChangedReservationError extends Error {
	constructor(readonly item: BatchItem) {
		super("Batch request revision changed during reservation");
	}
}
export function toSafeBatchRun(summary: BatchSummary) {
	const { run, progress } = summary;
	return safeBatchRunSchema.parse({
		id: run.id,
		kind: run.input?.kind ?? null,
		mediaSourceId: run.input?.mediaSourceId ?? null,
		status: run.status,
		progress,
		canRetry: !!run.input && ["failed", "cancelled"].includes(run.status),
		createdAt: run.createdAt,
		updatedAt: run.updatedAt,
		finishedAt: run.finishedAt,
	});
}
/** Coordinates fixed targets only. Dedicated media schedulers remain the sole executors. */
export class BatchRunService {
	constructor(private readonly deps: BatchRunServiceDeps) {}
	initialize() {
		return this.deps.repo.initialize();
	}
	async start(raw: BatchInput) {
		await this.initialize();
		const input = batchInputSchema.parse(raw);
		if (input.mediaIds) input.mediaIds = [...new Set(input.mediaIds)];
		const capture = this.deps.capture(input);
		const summary = await this.deps.transactions.transaction(async (tx) => {
			const run = await this.deps.repo.beginCapture(input, tx);
			let cursor: string | undefined;
			for (;;) {
				const page = await capture(cursor, tx);
				await this.deps.repo.appendTargets(run.id, page.targets, tx);
				if (!page.nextCursor) break;
				if (page.nextCursor === cursor)
					throw new Error("Batch capture cursor did not advance");
				cursor = page.nextCursor;
			}
			const result = await this.deps.repo.sealCapture(run.id, tx);
			if (
				input.mediaIds &&
				!input.recovery &&
				!(input.kind === "thumbnail" && input.missingOnly) &&
				result.progress.total !== input.mediaIds.length
			)
				throw new ResourceNotFoundError("Batch targets", run.id);
			return result;
		});
		this.notify(summary);
		return summary;
	}
	async dispatch(claim: BatchClaim) {
		try {
			// Renew between bounded pages. A crash resumes pending items only.
			let finished = false;
			let lastProgressAt = -Infinity;
			while (!finished) {
				try {
					await this.deps.repo.withActiveClaim(claim, async (tx) => {
						const targets = await this.deps.repo.pendingItems(claim, 25, tx);
						for (const item of targets) {
							const state = await this.deps.reserve(item, claim.input, tx);
							if (state && state.requestedRevision !== item.plannedRevision)
								throw new ChangedReservationError(item);
							if (!state) {
								await this.deps.repo.failItem(claim, item, "input_changed", tx);
								continue;
							}
							await this.deps.repo.bindItem(claim, item, state, tx);
						}
						finished = targets.length < 25;
						if (finished) await this.deps.repo.finishDispatch(claim, tx);
					});
				} catch (error) {
					if (!(error instanceof ChangedReservationError)) throw error;
					// The reservation transaction has rolled back. Never strand an unbound request.
					await this.deps.repo.withActiveClaim(claim, (tx) =>
						this.deps.repo.failItem(claim, error.item, "input_changed", tx),
					);
				}
				// Polling skips a run while dispatch holds its lease row lock. Report
				// between commits so a large dispatch cannot starve progress notifications.
				// Aggregate at most once a second, plus the first and final pages.
				if (finished || performance.now() - lastProgressAt >= 1000) {
					await this.reconcile(claim.id);
					lastProgressAt = performance.now();
				}
			}
		} catch (error) {
			if (!(error instanceof BatchAttemptLostError)) throw error;
		}
	}
	async reconcile(runId?: string) {
		for (const summary of await this.deps.repo.reconcile(
			runId ? 1 : 100,
			runId,
		))
			this.notify(
				summary,
				summary.statusChanged === false ? "progress" : undefined,
			);
	}
	async cancel(id: string) {
		const summary = await this.deps.repo.cancel(id);
		this.notify(summary, "cancel");
		return summary;
	}
	async retry(id: string, scope?: "failed") {
		const summary = await this.deps.repo.retry(id, scope);
		this.notify(summary, "retry");
		return summary;
	}
	private notify(
		summary: BatchSummary,
		action?: "retry" | "cancel" | "progress",
	) {
		try {
			this.deps.notify(summary, action);
		} catch (error) {
			this.deps.logger.warn(
				{ err: error, runId: summary.run.id },
				"Batch notification failed after commit",
			);
		}
	}
}
