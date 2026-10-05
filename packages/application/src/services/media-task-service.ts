import { createHash } from "node:crypto";
import path from "node:path";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	MediaProcessingSupersededError,
	serializeMediaTaskRevision,
	type MediaProcessingInput,
	type MediaTaskKind,
	type ProcessingOwner,
	type ProcessingSettings,
} from "@solid-imager/core/domain/processing/schemas";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import { isRecord } from "@solid-imager/core/utils/type-guards";
import type {
	MediaProcessingServiceDeps,
	PreparedThumbnail,
} from "./media-processing-service";

// Fixed positional serialization: array order is retained because extraction rules can be ordered.
export function getMediaTaskRevision(
	input: MediaProcessingInput,
	kind: MediaTaskKind,
	settings: ProcessingSettings,
): string {
	return createHash("sha256")
		.update(serializeMediaTaskRevision(input, kind, settings))
		.digest("hex");
}

type TaskHooks = {
	claimed(tx: Transaction): Promise<void>;
	completed(tx: Transaction): Promise<void>;
	changed(): void;
};

/** Shared output owner for jobs, metadata reads/reprocessing and thumbnail requests. */
export class MediaTaskService {
	constructor(private readonly deps: MediaProcessingServiceDeps) {}

	async processTask(
		sourceId: string,
		mediaId: string,
		kind: MediaTaskKind,
		owner?: ProcessingOwner,
		force = false,
	): Promise<void> {
		const media = await this.deps.mediaRepo.findById(mediaId);
		const source = await this.deps.sourceRepo.findById(sourceId);
		if (!media || media.mediaSourceId !== sourceId || source?.type !== "local")
			throw new Error("Local processing target not found");
		await this.execute(
			{
				mediaId,
				mediaSourceId: sourceId,
				sourcePath: localConnectionSchema.parse(source.connectionInfo).path,
				filePath: media.filePath,
				modifiedAt: media.modifiedAt,
				fileSize: media.fileSize,
				mediaType: media.mediaType,
			},
			kind,
			owner,
			undefined,
			force,
		);
	}

	async execute(
		input: MediaProcessingInput,
		kind: MediaTaskKind,
		owner?: ProcessingOwner,
		hooks?: TaskHooks,
		force = false,
	): Promise<void> {
		if (kind === "thumbnail" && input.mediaType === "audio") return;
		const revision = getMediaTaskRevision(
			input,
			kind,
			this.deps.getProcessingSettings(),
		);
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
				getMediaTaskRevision(input, kind, this.deps.getProcessingSettings()) !==
				revision
			)
				throw new MediaProcessingSupersededError();
		};
		let requestedForce = force;
		for (;;) {
			assertSettings();
			// Recheck after waiting for another owner: a newly published cache satisfies this request.
			const cacheMissing =
				kind === "thumbnail" &&
				!(await this.deps.hasThumbnails(input.mediaSourceId, input.mediaId));
			const result = await active(async (tx) => {
				const result = await this.deps.processingStateRepo.claim(
					input,
					kind,
					revision,
					owner ?? null,
					requestedForce || cacheMissing,
					tx,
				);
				if (result.status === "claimed") await hooks?.claimed(tx);
				if (result.status === "completed") await hooks?.completed(tx);
				return result;
			});
			if (result.status === "completed") {
				hooks?.changed();
				return;
			}
			if (result.status === "busy") {
				requestedForce = false;
				await new Promise<void>((resolve) => setTimeout(resolve, 250));
				continue;
			}
			hooks?.changed();
			const { claim } = result;
			const heartbeat = setInterval(() => {
				void this.deps.processingStateRepo
					.heartbeat(claim)
					.catch((error: unknown) =>
						this.deps.logger?.warn(
							{ err: error, mediaId: input.mediaId, kind },
							"Processing heartbeat failed",
						),
					);
			}, 30_000);
			let thumbnail: PreparedThumbnail | undefined;
			try {
				let output: (tx: Transaction) => Promise<void>;
				if (kind === "metadata") {
					const metadata = await this.deps.imageProcessor.extractMetadata(
						path.join(input.sourcePath, input.filePath),
					);
					output = async (tx) => {
						await this.deps.mediaRepo.upsertGenerationInfo(
							input.mediaId,
							typeof metadata.prompt === "object" && metadata.prompt !== null
								? JSON.stringify(metadata.prompt)
								: typeof metadata.prompt === "string"
									? metadata.prompt
									: null,
							isRecord(metadata.workflow) ? metadata.workflow : null,
							tx,
						);
						await this.deps.tagRepo.removeTagsFromSource(
							input.mediaId,
							"comfyui_workflow",
							tx,
						);
						await this.deps.tagRepo.addTagsToMedia(
							input.mediaId,
							metadata.tags,
							"comfyui_workflow",
							tx,
						);
					};
				} else {
					thumbnail = await this.deps.prepareThumbnail(
						{ id: input.mediaId, filePath: input.filePath },
						input.sourcePath,
						input.mediaSourceId,
					);
					output = thumbnail.commit;
				}
				await active(async (tx) => {
					assertSettings();
					await this.deps.processingStateRepo.commit(
						input,
						claim,
						async (tx) => {
							// Recheck after waiting for DB locks, immediately before publishing.
							assertSettings();
							await output(tx);
							assertSettings();
						},
						tx,
					);
					await hooks?.completed(tx);
				});
				hooks?.changed();
				if (kind === "thumbnail") {
					try {
						this.deps.publishSourceEvent(
							input.mediaSourceId,
							"thumbnail-generated",
							{ mediaId: input.mediaId },
						);
					} catch (error) {
						this.deps.logger?.warn(
							{ err: error },
							"Failed to publish thumbnail event",
						);
					}
				}
				return;
			} catch (error) {
				// Token CAS keeps an old failure from overwriting a newer request, including cancellation.
				await this.deps.transactionManager.transaction((tx) =>
					this.deps.processingStateRepo.fail(
						claim,
						error instanceof Error ? error.message : "Processing failed",
						tx,
					),
				);
				throw error;
			} finally {
				clearInterval(heartbeat);
				try {
					await thumbnail?.cleanup();
				} catch (error) {
					this.deps.logger?.warn(
						{ err: error },
						"Failed to clean staged thumbnail files",
					);
				}
			}
		}
	}
}
