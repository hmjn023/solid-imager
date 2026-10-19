import type {
	Transaction,
	TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	MediaProcessingSupersededError,
	serializeMediaProcessingInput,
	type AiTaskKind,
	type TaggingProcessingSettings,
	type MediaProcessingInput,
	type MediaProcessingClaim,
	type ProcessingRequestIdentity,
	type ScheduledMediaWork,
} from "@solid-imager/core/domain/processing/schemas";
import {
	AiInferenceBusyError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import type { IMediaProcessingSchedulerRepository } from "@solid-imager/core/domain/repositories/media-processing-state-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import type { SourceEventPublisher } from "@solid-imager/core/domain/sources/events";
import { isRecord } from "@solid-imager/core/utils/type-guards";
import { abortableDelay } from "@solid-imager/core/utils/abortable-delay";
import type { ILogger } from "../ports/media-service";
import { MediaProcessingScheduler } from "./media-processing-scheduler";

// Bound HTTP observation independently from durable execution. Keep this below
// the shared HTTP budget so the observer can return its own result.
const AI_TASK_WAIT_TIMEOUT_MS = 180_000;

export type AiMediaTaskDeps = {
	processingStateRepo: IMediaProcessingSchedulerRepository;
	transactionManager: TransactionManager;
	mediaRepo: IMediaRepository;
	sourceRepo: SourceRepository;
	logger?: ILogger;
	publishSourceEvent?: SourceEventPublisher;
};
export type AiMediaTaskHandler<Result> = {
	currentRevision(input: MediaProcessingInput): string;
	canReuse(): boolean;
	load(input: MediaProcessingInput, tx: Transaction): Promise<Result | null>;
	infer(input: MediaProcessingInput): Promise<Result>;
	save(
		input: MediaProcessingInput,
		response: Result,
		tx: Transaction,
		claim: MediaProcessingClaim,
	): Promise<void>;
	afterCommit?(input: MediaProcessingInput): void | Promise<void>;
};
export function canReuseAiResult(settings: TaggingProcessingSettings): boolean {
	return (
		// Remote services do not expose an immutable model version, so the configured endpoint identifies reusable results.
		settings.endpoint !== "" ||
		(settings.modelVersion !== "unknown" &&
			settings.runtimeVersion !== "unknown")
	);
}
/** Only the dedicated runner performs inference. Direct calls and jobs request/observe. */
export class AiMediaTaskService<Result> {
	private readonly scheduler: MediaProcessingScheduler;
	constructor(
		private readonly deps: AiMediaTaskDeps,
		private readonly kind: AiTaskKind,
		private readonly handler: AiMediaTaskHandler<Result>,
	) {
		this.scheduler = new MediaProcessingScheduler({
			...deps,
			onStateChanged: (input, taskKind) =>
				deps.publishSourceEvent?.(
					input?.mediaSourceId ?? "*",
					"media-processing-changed",
					{ mediaId: input?.mediaId, kind: taskKind },
				),
			handlers: {
				[kind]: {
					currentRevision: (input: MediaProcessingInput) =>
						handler.currentRevision(input),
					isCapacityError: (error: unknown) =>
						error instanceof AiInferenceBusyError,
					isRetryable: (error: unknown) =>
						isRecord(error) &&
						typeof error.code === "string" &&
						[
							"NETWORK_ERROR",
							"TIMEOUT",
							"TOO_MANY_REQUESTS",
							"EAGAIN",
							"EBUSY",
							"EMFILE",
							"ENFILE",
							"ETIMEDOUT",
							"ECONNRESET",
							"ECONNREFUSED",
						].includes(error.code),
					prepare: async (work: ScheduledMediaWork) => {
						const response = await handler.infer(work.input);
						return {
							commit: (tx: Transaction) =>
								handler.save(work.input, response, tx, work.claim),
							afterCommit: async () => {
								await handler.afterCommit?.(work.input);
							},
						};
					},
				},
			},
		});
	}
	runOnce() {
		return this.scheduler.runOnce();
	}
	private async inputFor(sourceId: string, mediaId: string, tx: Transaction) {
		const media = await this.deps.mediaRepo.findById(mediaId, tx, {
			forUpdate: true,
		});
		const source = await this.deps.sourceRepo.findById(sourceId, tx);
		if (
			!media ||
			media.mediaSourceId !== sourceId ||
			media.mediaType !== "image" ||
			source?.type !== "local"
		)
			throw new ResourceNotFoundError("Local AI image", mediaId);
		return {
			mediaId,
			mediaSourceId: sourceId,
			mediaType: media.mediaType,
			sourcePath: localConnectionSchema.parse(source.connectionInfo).path,
			filePath: media.filePath,
			modifiedAt: media.modifiedAt,
			fileSize: media.fileSize,
		};
	}
	private async request(
		input: MediaProcessingInput,
		force: boolean,
		tx: Transaction,
		batchId?: string,
	) {
		const revision = this.handler.currentRevision(input);
		const previous = (
			await this.deps.processingStateRepo.findByMediaIds([input.mediaId], tx)
		).find((row) => row.taskKind === this.kind);
		if (
			!force &&
			previous?.status === "completed" &&
			previous.requestedRevision === revision
		)
			force =
				previous.completedRevision !== revision ||
				!this.handler.canReuse() ||
				!(await this.handler.load(input, tx));
		return this.deps.processingStateRepo.request(
			{ input, taskKind: this.kind, revision, maxAttempts: 5, force, batchId },
			tx,
		);
	}
	requestForMedia(
		sourceId: string,
		mediaId: string,
		force = false,
		tx?: Transaction,
		batchId?: string,
	) {
		const action = async (tx: Transaction) =>
			this.request(
				await this.inputFor(sourceId, mediaId, tx),
				force,
				tx,
				batchId,
			);
		return tx ? action(tx) : this.deps.transactionManager.transaction(action);
	}
	/** Bind every target atomically before waiting. Retry replaces only this observer's failed request. */
	async execute(
		input: MediaProcessingInput,
		force = false,
		expected?: ProcessingRequestIdentity,
		signal?: AbortSignal,
	): Promise<{ response: Result; reused: boolean }> {
		signal?.throwIfAborted();
		let identity = expected;
		let reused = false;
		if (!identity) {
			const state = await this.requestForMedia(
				input.mediaSourceId,
				input.mediaId,
				force,
			);
			identity = state;
			reused = state.status === "completed";
		}
		const request = identity;
		const active = <T>(action: (tx: Transaction) => Promise<T>) =>
			this.deps.transactionManager.transaction(action);
		const deadline = Date.now() + AI_TASK_WAIT_TIMEOUT_MS;
		for (;;) {
			signal?.throwIfAborted();
			const response = await active(async (tx) => {
				const currentInput = await this.inputFor(
					input.mediaSourceId,
					input.mediaId,
					tx,
				).catch((error) => {
					if (error instanceof ResourceNotFoundError)
						throw new MediaProcessingSupersededError();
					throw error;
				});
				if (
					serializeMediaProcessingInput(currentInput) !==
						serializeMediaProcessingInput(input) ||
					this.handler.currentRevision(currentInput) !==
						request.requestedRevision
				)
					throw new MediaProcessingSupersededError();
				const state = (
					await this.deps.processingStateRepo.findByMediaIds(
						[input.mediaId],
						tx,
					)
				).find((row) => row.taskKind === this.kind);
				if (
					!state ||
					state.requestId !== request.requestId ||
					state.requestedRevision !== request.requestedRevision
				)
					throw new MediaProcessingSupersededError();
				if (state.status === "failed")
					throw new Error(state.lastError ?? "AI task failed");
				if (state.status !== "completed") return null;
				const result = await this.handler.load(currentInput, tx);
				if (
					!result ||
					this.handler.currentRevision(currentInput) !==
						request.requestedRevision
				)
					throw new MediaProcessingSupersededError();
				return result;
			});
			signal?.throwIfAborted();
			if (response) return { response, reused };
			if (Date.now() >= deadline)
				throw new Error("AI task is still pending; request remains queued");
			await abortableDelay(250, signal);
		}
	}
	async reconcile() {
		let afterId: string | undefined;
		for (;;) {
			const ids = await this.deps.processingStateRepo.findInlineMediaIds(
				afterId,
				100,
				[this.kind],
			);
			if (!ids.length) return;
			for (const mediaId of ids) {
				const media = await this.deps.mediaRepo.findById(mediaId);
				if (!media || media.mediaType !== "image") continue;
				const source = await this.deps.sourceRepo.findById(media.mediaSourceId);
				if (
					source?.type !== "local" ||
					!localConnectionSchema.safeParse(source.connectionInfo).success
				) {
					this.deps.logger?.warn(
						{ mediaId, kind: this.kind },
						"Skipped AI handoff without a valid local image",
					);
					continue;
				}
				try {
					await this.requestForMedia(media.mediaSourceId, mediaId);
				} catch (error) {
					if (
						!(
							error instanceof ResourceNotFoundError ||
							error instanceof MediaProcessingSupersededError
						)
					)
						throw error;
					this.deps.logger?.warn(
						{ err: error, mediaId, kind: this.kind },
						"AI target changed during handoff",
					);
				}
			}
			afterId = ids.at(-1);
		}
	}
}
