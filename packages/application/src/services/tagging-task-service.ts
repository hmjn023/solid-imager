import { createHash } from "node:crypto";
import type {
	Transaction,
	TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	MediaProcessingSupersededError,
	serializeMediaProcessingInput,
	type MediaProcessingInput,
	type ProcessingOwner,
	type TaggingProcessingSettings,
} from "@solid-imager/core/domain/processing/schemas";
import type { IJobRepository } from "@solid-imager/core/domain/repositories/job-repository";
import type { IMediaProcessingStateRepository } from "@solid-imager/core/domain/repositories/media-processing-state-repository";
import type { TaggingResponse } from "@solid-imager/core/domain/tagging/schemas";
import type { ILogger } from "../ports/media-service";

/** Fixed field order; bump tagging-v1 when preprocessing or output semantics change. */
export function getTaggingTaskRevision(
	input: MediaProcessingInput,
	settings: TaggingProcessingSettings,
): string {
	return createHash("sha256")
		.update(
			JSON.stringify([
				"tagging-v1",
				serializeMediaProcessingInput(input),
				input.mediaType,
				settings.model,
				settings.modelVersion,
				settings.runtimeVersion,
				settings.provider,
				settings.device,
				settings.endpoint,
			]),
		)
		.digest("hex");
}

export type TaggingTaskDeps = {
	processingStateRepo: IMediaProcessingStateRepository;
	transactionManager: TransactionManager;
	jobRepo: IJobRepository;
	getTaggingSettings: () => TaggingProcessingSettings;
	logger?: ILogger;
};

export function canReuseTaggingResult(
	settings: TaggingProcessingSettings,
): boolean {
	return (
		settings.endpoint === "" &&
		settings.modelVersion !== "unknown" &&
		settings.runtimeVersion !== "unknown"
	);
}

/** Shares successful inference across jobs and direct requests, including empty results. */
export class TaggingTaskService {
	constructor(private readonly deps: TaggingTaskDeps) {}

	async execute(
		input: MediaProcessingInput,
		infer: () => Promise<TaggingResponse>,
		save: (response: TaggingResponse, tx: Transaction) => Promise<void>,
		owner?: ProcessingOwner,
		force = false,
	): Promise<{ response: TaggingResponse; reused: boolean }> {
		const settings = this.deps.getTaggingSettings();
		const revision = getTaggingTaskRevision(input, settings);
		const active = <T>(action: (tx: Transaction) => Promise<T>) =>
			owner
				? this.deps.jobRepo.withActiveAttempt(
						owner.jobId,
						owner.attemptCount,
						action,
					)
				: this.deps.transactionManager.transaction(action);
		const assertSettings = () => {
			if (
				revision !==
				getTaggingTaskRevision(input, this.deps.getTaggingSettings())
			)
				throw new MediaProcessingSupersededError();
		};
		// Remote providers do not expose their model/runtime identity. Reuse only an in-flight request.
		let requestedForce = force || !canReuseTaggingResult(settings);
		for (;;) {
			assertSettings();
			const result = await active(async (tx) => {
				assertSettings();
				let claimed = await this.deps.processingStateRepo.claim(
					input,
					"tagging",
					revision,
					owner ?? null,
					requestedForce,
					tx,
				);
				if (claimed.status === "completed") {
					const response =
						await this.deps.processingStateRepo.findTaggingResult(
							input.mediaId,
							revision,
							tx,
						);
					assertSettings();
					if (response) return { status: "cached" as const, response };
					claimed = await this.deps.processingStateRepo.claim(
						input,
						"tagging",
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
				throw new Error("Tagging claim did not provide a cached result");
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
							"Tagging heartbeat failed",
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
							await save(response, tx);
							await this.deps.processingStateRepo.saveTaggingResult(
								claim,
								response,
								tx,
							);
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
						error instanceof Error ? error.message : "Tagging failed",
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
