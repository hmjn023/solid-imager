import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import type {
	Transaction,
	TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	mediaTaskKindSchema,
	isMediaTaskApplicable,
	type MediaProcessingInput,
	type MediaProcessingState,
	type MediaTaskKind,
	type ProcessingFailureCode,
	type ProcessingListRequest,
	type ProcessingRetryRequest,
	type ProcessingRequestStep,
	type SafeMediaProcessing,
	type SafeProcessingStep,
} from "@solid-imager/core/domain/processing/schemas";
import type {
	IProcessingManagementRepository,
	ProcessingTarget,
} from "@solid-imager/core/domain/repositories/processing-management-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { IMediaProcessingStateRepository } from "@solid-imager/core/domain/repositories/media-processing-state-repository";
import type { ILogger } from "../ports/media-service";

/** Match only known failure categories; raw diagnostic strings never leave the server. */
export function processingFailureCode(
	state: MediaProcessingState,
): ProcessingFailureCode | null {
	if (!state.lastError && state.status !== "failed") return null;
	const message = state.lastError ?? "";
	if (/ENOENT|no such file/i.test(message)) return "file_missing";
	if (/EACCES|EPERM|permission denied/i.test(message))
		return "file_access_denied";
	if (
		/ECONNREFUSED|ECONNRESET|ETIMEDOUT|connection refused|timed? out/i.test(
			message,
		)
	)
		return "service_unavailable";
	if (/input.*changed|superseded/i.test(message)) return "input_changed";
	if (/lease.*expir/i.test(message)) return "lease_expired";
	if (state.status === "failed" && state.attemptCount >= state.maxAttempts)
		return "retry_limit";
	return "processing_failed";
}

export class ProcessingManagementService {
	constructor(
		private readonly deps: {
			targets: IProcessingManagementRepository;
			states: IMediaProcessingStateRepository;
			mediaRepo: IMediaRepository;
			transactions: TransactionManager;
			revision(input: MediaProcessingInput, kind: MediaTaskKind): string;
			request(
				sourceId: string,
				mediaId: string,
				kind: MediaTaskKind,
				tx: Transaction,
			): Promise<void>;
			notify?(input: MediaProcessingInput, kind: MediaTaskKind): void;
			logger?: ILogger;
		},
	) {}
	private project(
		target: ProcessingTarget,
		states: MediaProcessingState[],
	): SafeMediaProcessing {
		const { input } = target;
		return {
			mediaId: input.mediaId,
			mediaSourceId: input.mediaSourceId,
			fileName: target.fileName,
			sourceName: target.sourceName,
			mediaType: input.mediaType,
			modifiedAt: input.modifiedAt,
			steps: mediaTaskKindSchema.options.map((kind): SafeProcessingStep => {
				const applicable = isMediaTaskApplicable(input.mediaType, kind);
				const state = applicable
					? states.find((row) => row.taskKind === kind)
					: undefined;
				const isCurrent =
					applicable &&
					!!state &&
					state.requestedRevision === this.deps.revision(input, kind) &&
					(state.status !== "completed" ||
						state.completedRevision === state.requestedRevision);
				return {
					kind,
					status: !applicable ? "skipped" : (state?.status ?? "not_requested"),
					isCurrent,
					requestId: state?.requestId ?? null,
					attemptCount: state?.attemptCount ?? 0,
					maxAttempts: state?.maxAttempts ?? null,
					availableAt:
						state?.status === "pending" && isCurrent ? state.availableAt : null,
					updatedAt: state?.updatedAt ?? null,
					failureCode: state ? processingFailureCode(state) : null,
					canRetry: applicable && state?.status === "failed",
					canRequest:
						applicable && (!state || !isCurrent || state.status === "failed"),
				};
			}),
		};
	}
	async list(input: ProcessingListRequest) {
		const targets = await this.deps.targets.list(input);
		const states = await this.deps.states.findByMediaIds(
			targets.items.map((row) => row.input.mediaId),
		);
		return {
			items: targets.items.map((target) =>
				this.project(
					target,
					states.filter((row) => row.mediaId === target.input.mediaId),
				),
			),
			total: targets.total,
		};
	}
	async get(mediaId: string) {
		const target = await this.deps.targets.findByMediaId(mediaId);
		if (!target) throw new ResourceNotFoundError("Local media", mediaId);
		return this.project(
			target,
			await this.deps.states.findByMediaIds([mediaId]),
		);
	}
	async retry(input: ProcessingRetryRequest) {
		return this.request(input, true);
	}
	async request(input: ProcessingRequestStep, failedOnly = false) {
		const target = await this.deps.transactions.transaction(async (tx) => {
			await this.deps.mediaRepo.findById(input.mediaId, tx, {
				forUpdate: true,
			});
			const current = await this.deps.targets.findByMediaId(input.mediaId, tx);
			if (!current)
				throw new ResourceNotFoundError("Local media", input.mediaId);
			const state = (
				await this.deps.states.findByMediaIds([input.mediaId], tx)
			).find((row) => row.taskKind === input.kind);
			if (
				(state?.requestId ?? null) !== input.requestId ||
				(failedOnly && state?.status !== "failed") ||
				!this.project(current, state ? [state] : []).steps.find(
					(step) => step.kind === input.kind,
				)?.canRequest
			)
				throw new ResourceConflictError(
					"The selected request changed or no longer needs processing. Refresh its current state.",
				);
			await this.deps.request(
				current.input.mediaSourceId,
				input.mediaId,
				input.kind,
				tx,
			);
			return current;
		});
		try {
			this.deps.notify?.(target.input, input.kind);
		} catch (error) {
			this.deps.logger?.warn(
				{ err: error, mediaId: input.mediaId },
				"Processing retry notification failed",
			);
		}
		return this.get(input.mediaId);
	}
}
