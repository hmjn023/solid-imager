import type {
	Transaction,
	TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	mediaTaskKindSchema,
	MediaProcessingSupersededError,
	type MediaProcessingInput,
	type MediaTaskKind,
	type ScheduledMediaWork,
} from "@solid-imager/core/domain/processing/schemas";
import type { IMediaProcessingSchedulerRepository } from "@solid-imager/core/domain/repositories/media-processing-state-repository";
import type { ILogger } from "../ports/media-service";

export type PreparedMediaTask = {
	/** Save/publish only inside the scheduler's fenced transaction. */
	commit(tx: Transaction): Promise<void>;
	cleanup?(): Promise<void>;
	afterCommit?(): Promise<void>;
};
export type ScheduledMediaTaskHandler = {
	currentRevision(input: MediaProcessingInput): string;
	prepare(work: ScheduledMediaWork): Promise<PreparedMediaTask>;
	/** Unknown/invalid input errors must be terminal; classify transient failures explicitly. */
	isRetryable(error: unknown): boolean;
};

/** One durable unit of work per call. Hosts can poll this from independent AI/file pools. */
export class MediaProcessingScheduler {
	private readonly taskKinds: MediaTaskKind[];
	constructor(
		private readonly deps: {
			processingStateRepo: IMediaProcessingSchedulerRepository;
			transactionManager: TransactionManager;
			handlers: Partial<Record<MediaTaskKind, ScheduledMediaTaskHandler>>;
			logger?: ILogger;
		},
	) {
		this.taskKinds = mediaTaskKindSchema.options.filter(
			(kind) => deps.handlers[kind],
		);
	}

	async runOnce(): Promise<
		"idle" | "completed" | "retry" | "failed" | "superseded"
	> {
		const { processingStateRepo: repo, transactionManager: transactions } =
			this.deps;
		await transactions.transaction((tx) =>
			repo.recoverExpired(this.taskKinds, 25, tx),
		);
		const work = await transactions.transaction((tx) =>
			repo.claimDue(this.taskKinds, tx),
		);
		if (!work) return "idle";
		const handler = this.deps.handlers[work.claim.taskKind];
		if (!handler) throw new Error("Scheduled handler is missing");
		let prepared: PreparedMediaTask | undefined;
		let leaseLost = false;
		const assertCurrent = () => {
			if (
				leaseLost ||
				handler.currentRevision(work.input) !== work.claim.revision
			)
				throw new MediaProcessingSupersededError();
		};
		const heartbeat = setInterval(() => {
			void repo
				.heartbeat(work.claim)
				.then((retained) => {
					if (!retained) leaseLost = true;
				})
				.catch((error: unknown) => {
					this.deps.logger?.warn(
						{ err: error, mediaId: work.input.mediaId },
						"Scheduled media heartbeat failed",
					);
				});
		}, 30_000);
		try {
			assertCurrent();
			prepared = await handler.prepare(work);
			assertCurrent();
			const output = prepared;
			await transactions.transaction((tx) =>
				repo.commit(
					work.input,
					work.claim,
					async (outputTx) => {
						assertCurrent();
						await output.commit(outputTx);
						assertCurrent();
					},
					tx,
				),
			);
		} catch (error) {
			const state = await transactions.transaction((tx) =>
				repo.settleFailure(
					work.claim,
					error instanceof Error ? error.message : "Media task failed",
					!(error instanceof MediaProcessingSupersededError) &&
						handler.isRetryable(error),
					tx,
				),
			);
			return !state
				? "superseded"
				: state.status === "pending"
					? "retry"
					: "failed";
		} finally {
			clearInterval(heartbeat);
			try {
				await prepared?.cleanup?.();
			} catch (error) {
				this.deps.logger?.warn(
					{ err: error, mediaId: work.input.mediaId },
					"Scheduled media cleanup failed",
				);
			}
		}
		try {
			await prepared.afterCommit?.();
		} catch (error) {
			this.deps.logger?.warn(
				{ err: error, mediaId: work.input.mediaId },
				"Scheduled media notification failed",
			);
		}
		return "completed";
	}
}
