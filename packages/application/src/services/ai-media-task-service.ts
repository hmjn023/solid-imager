import type { TaggingProcessingSettings } from "@solid-imager/core/domain/processing/schemas";
import type {
	Transaction,
	TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	MediaProcessingSupersededError,
	type MediaProcessingInput,
	type ProcessingOwner,
	type MediaProcessingClaim,
} from "@solid-imager/core/domain/processing/schemas";
import type { IJobRepository } from "@solid-imager/core/domain/repositories/job-repository";
import type { IMediaProcessingStateRepository } from "@solid-imager/core/domain/repositories/media-processing-state-repository";
import type { ILogger } from "../ports/media-service";

export type AiMediaTaskDeps = {
	processingStateRepo: IMediaProcessingStateRepository;
	transactionManager: TransactionManager;
	jobRepo: IJobRepository;
	logger?: ILogger;
};

export function canReuseAiResult(settings: TaggingProcessingSettings): boolean {
	return (
		settings.endpoint === "" &&
		settings.modelVersion !== "unknown" &&
		settings.runtimeVersion !== "unknown"
	);
}

/** Common claim, lease and transaction boundary for media AI tasks. */
export class AiMediaTaskService<Result> {
	constructor(private readonly deps: AiMediaTaskDeps) {}

	async execute(
		input: MediaProcessingInput,
		kind: "tagging" | "ccip",
		currentRevision: () => string,
		load: (tx: Transaction) => Promise<Result | null>,
		infer: () => Promise<Result>,
		save: (
			response: Result,
			tx: Transaction,
			claim: MediaProcessingClaim,
		) => Promise<void>,
		owner?: ProcessingOwner,
		force = false,
	): Promise<{ response: Result; reused: boolean }> {
		const revision = currentRevision();
		const active = <T>(action: (tx: Transaction) => Promise<T>) =>
			owner
				? this.deps.jobRepo.withActiveAttempt(
						owner.jobId,
						owner.attemptCount,
						action,
					)
				: this.deps.transactionManager.transaction(action);
		const assertSettings = () => {
			if (revision !== currentRevision())
				throw new MediaProcessingSupersededError();
		};
		// Concurrent force requests share the same in-flight claim.
		let requestedForce = force;
		for (;;) {
			assertSettings();
			const result = await active(async (tx) => {
				assertSettings();
				let claimed = await this.deps.processingStateRepo.claim(
					input,
					kind,
					revision,
					owner ?? null,
					requestedForce,
					tx,
				);
				if (claimed.status === "completed") {
					const response = await load(tx);
					assertSettings();
					if (response) return { status: "cached" as const, response };
					claimed = await this.deps.processingStateRepo.claim(
						input,
						kind,
						revision,
						owner ?? null,
						true,
						tx,
					);
				}
				return claimed;
			});
			if (result.status === "cached")
				return { response: result.response, reused: true };
			if (result.status === "busy") {
				requestedForce = false;
				await new Promise<void>((resolve) => setTimeout(resolve, 250));
				continue;
			}
			if (result.status !== "claimed")
				throw new Error("AI claim did not provide a cached result");
			const { claim } = result;
			let leaseLost = false;
			const heartbeat = setInterval(() => {
				void this.deps.processingStateRepo
					.heartbeat(claim)
					.then((retained) => {
						if (!retained) leaseLost = true;
					})
					.catch((error: unknown) => {
						this.deps.logger?.warn(
							{ err: error, mediaId: input.mediaId },
							"AI task heartbeat failed",
						);
					});
			}, 30_000);
			try {
				const response = await infer();
				if (leaseLost) throw new MediaProcessingSupersededError();
				await active(async (tx) => {
					assertSettings();
					await this.deps.processingStateRepo.commit(
						input,
						claim,
						async (tx) => {
							assertSettings();
							await save(response, tx, claim);
							assertSettings();
						},
						tx,
					);
				});
				return { response, reused: false };
			} catch (error) {
				await this.deps.transactionManager.transaction((tx) =>
					this.deps.processingStateRepo.fail(
						claim,
						error instanceof Error ? error.message : "AI task failed",
						tx,
					),
				);
				throw error;
			} finally {
				clearInterval(heartbeat);
			}
		}
	}
}
