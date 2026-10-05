import { AiMediaTaskService, canReuseAiResult } from "./ai-media-task-service";
import { createHash } from "node:crypto";
import type {
	Transaction,
	TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
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

/** Shares successful inference across jobs and direct requests, including empty results. */
export class TaggingTaskService {
	private readonly tasks: AiMediaTaskService<TaggingResponse>;
	constructor(private readonly deps: TaggingTaskDeps) {
		this.tasks = new AiMediaTaskService(deps);
	}
	execute(
		input: MediaProcessingInput,
		infer: () => Promise<TaggingResponse>,
		save: (response: TaggingResponse, tx: Transaction) => Promise<void>,
		owner?: ProcessingOwner,
		force = false,
	) {
		return this.tasks.execute(
			input,
			"tagging",
			() => getTaggingTaskRevision(input, this.deps.getTaggingSettings()),
			(tx) =>
				this.deps.processingStateRepo.findTaggingResult(
					input.mediaId,
					getTaggingTaskRevision(input, this.deps.getTaggingSettings()),
					tx,
				),
			infer,
			async (response, tx, claim) => {
				await save(response, tx);
				await this.deps.processingStateRepo.saveTaggingResult(
					claim,
					response,
					tx,
				);
			},
			owner,
			force || !canReuseAiResult(this.deps.getTaggingSettings()),
		);
	}
}
