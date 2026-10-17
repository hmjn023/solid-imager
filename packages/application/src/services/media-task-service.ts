import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import { createHash } from "node:crypto";
import path from "node:path";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	MediaProcessingSupersededError,
	serializeMediaTaskRevision,
	isMediaTaskApplicable,
	type MediaProcessingInput,
	type FileTaskKind,
	type ProcessingSettings,
	type MediaProcessingState,
	type ScheduledMediaWork,
} from "@solid-imager/core/domain/processing/schemas";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import { isRecord } from "@solid-imager/core/utils/type-guards";
import type { MediaProcessingServiceDeps } from "./media-processing-service";

import { MediaProcessingScheduler } from "./media-processing-scheduler";

// Fixed positional serialization: array order is retained because extraction rules can be ordered.
export function getMediaTaskRevision(
	input: MediaProcessingInput,
	kind: FileTaskKind,
	settings: ProcessingSettings,
): string {
	return createHash("sha256")
		.update(serializeMediaTaskRevision(input, kind, settings))
		.digest("hex");
}

/** File computation is owned solely by dedicated schedulers; callers only request/observe. */
export class MediaTaskService {
	private readonly schedulers: Record<FileTaskKind, MediaProcessingScheduler>;
	constructor(private readonly deps: MediaProcessingServiceDeps) {
		this.schedulers = {
			metadata: this.scheduler("metadata"),
			thumbnail: this.scheduler("thumbnail"),
		};
	}
	private scheduler(kind: FileTaskKind) {
		return new MediaProcessingScheduler({
			processingStateRepo: this.deps.processingStateRepo,
			transactionManager: this.deps.transactionManager,
			logger: this.deps.logger,
			onStateChanged: (input, taskKind) =>
				this.deps.publishSourceEvent(
					input?.mediaSourceId ?? "*",
					"media-processing-changed",
					{ mediaId: input?.mediaId, kind: taskKind },
				),
			handlers: {
				[kind]: {
					currentRevision: (input: MediaProcessingInput) =>
						getMediaTaskRevision(
							input,
							kind,
							this.deps.getProcessingSettings(),
						),
					isRetryable: (error: unknown) =>
						isRecord(error) &&
						typeof error.code === "string" &&
						[
							"EAGAIN",
							"EBUSY",
							"EMFILE",
							"ENFILE",
							"ETIMEDOUT",
							"ECONNRESET",
						].includes(error.code),
					prepare: async (work: ScheduledMediaWork) => {
						const { input } = work;
						// Requests persisted by older versions may still reach the runner.
						if (!isMediaTaskApplicable(input.mediaType, kind))
							return { commit: async () => {} };
						if (kind === "metadata") {
							const metadata = await this.deps.imageProcessor.extractMetadata(
								path.join(input.sourcePath, input.filePath),
							);
							return {
								commit: async (tx: Transaction) => {
									await this.deps.mediaRepo.upsertGenerationInfo(
										input.mediaId,
										typeof metadata.prompt === "object" &&
											metadata.prompt !== null
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
								},
								afterCommit: async () => {
									this.deps.publishSourceEvent(
										input.mediaSourceId,
										"media-changed",
										{ mediaId: input.mediaId, filePath: input.filePath },
									);
								},
							};
						}
						const prepared = await this.deps.prepareThumbnail(
							{ id: input.mediaId, filePath: input.filePath },
							input.sourcePath,
							input.mediaSourceId,
							work.claim,
						);
						return {
							...prepared,
							afterCommit: async () => {
								this.deps.publishSourceEvent(
									input.mediaSourceId,
									"thumbnail-generated",
									{ mediaId: input.mediaId },
								);
							},
						};
					},
				},
			},
		});
	}
	runOnce(kind: FileTaskKind) {
		return this.schedulers[kind].runOnce();
	}
	async request(
		input: MediaProcessingInput,
		kind: FileTaskKind,
		tx: Transaction,
		force = false,
		repair = false,
		batchId?: string,
	) {
		if (!isMediaTaskApplicable(input.mediaType, kind)) {
			await this.deps.processingStateRepo.skipInapplicable(input, kind, tx);
			return null;
		}
		const revision = getMediaTaskRevision(
			input,
			kind,
			this.deps.getProcessingSettings(),
		);
		if (repair && !force) {
			const previous = (
				await this.deps.processingStateRepo.findByMediaIds([input.mediaId], tx)
			).find((row) => row.taskKind === kind);
			if (
				previous?.status === "completed" &&
				previous.requestedRevision === revision
			) {
				force =
					kind === "thumbnail"
						? !(await this.deps.hasThumbnails(
								input.mediaSourceId,
								input.mediaId,
							))
						: !(await this.deps.mediaRepo.getGenerationInfo(input.mediaId, tx));
			}
		}
		return this.deps.processingStateRepo.request(
			{ input, taskKind: kind, revision, maxAttempts: 5, force, batchId },
			tx,
		);
	}
	async requestTask(
		sourceId: string,
		mediaId: string,
		kind: FileTaskKind,
		force = false,
		tx?: Transaction,
		repair = false,
		batchId?: string,
	) {
		const action = async (tx: Transaction) => {
			const media = await this.deps.mediaRepo.findById(mediaId, tx, {
				forUpdate: true,
			});
			const source = await this.deps.sourceRepo.findById(sourceId, tx);
			if (
				!media ||
				media.mediaSourceId !== sourceId ||
				source?.type !== "local"
			)
				throw new ResourceNotFoundError("Local processing target", mediaId);
			return this.request(
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
				tx,
				force,
				repair,
				batchId,
			);
		};
		return tx ? action(tx) : this.deps.transactionManager.transaction(action);
	}
	async reconcile() {
		let afterId: string | undefined;
		for (;;) {
			const ids = await this.deps.processingStateRepo.findInlineMediaIds(
				afterId,
				100,
			);
			if (!ids.length) return;
			for (const id of ids) {
				const media = await this.deps.mediaRepo.findById(id);
				if (!media) continue;

				const source = await this.deps.sourceRepo.findById(media.mediaSourceId);
				if (
					source?.type !== "local" ||
					!localConnectionSchema.safeParse(source.connectionInfo).success
				) {
					this.deps.logger?.warn(
						{ mediaId: id },
						"Skipped processing state without a valid local source",
					);
					continue;
				}
				const states = await this.deps.processingStateRepo.findByMediaIds([id]);
				for (const state of states) {
					if (
						(state.taskKind !== "metadata" && state.taskKind !== "thumbnail") ||
						(state.executionMode !== "inline" &&
							isMediaTaskApplicable(media.mediaType, state.taskKind))
					)
						continue;
					try {
						await this.requestTask(
							media.mediaSourceId,
							id,
							state.taskKind,
							false,
							undefined,
							true,
						);
					} catch (error) {
						if (
							!(
								error instanceof ResourceNotFoundError ||
								error instanceof MediaProcessingSupersededError
							)
						)
							throw error;
						this.deps.logger?.warn(
							{ err: error, mediaId: id },
							"Processing target changed during handoff",
						);
					}
				}
			}
			afterId = ids.at(-1);
		}
	}
	async wait(
		mediaId: string,
		kind: FileTaskKind,
		request: Pick<MediaProcessingState, "requestId" | "requestedRevision">,
	) {
		const deadline = Date.now() + 120_000;
		for (;;) {
			const rows = await this.deps.processingStateRepo.findByMediaIds([
				mediaId,
			]);
			const current = rows.find((row) => row.taskKind === kind);
			if (
				!current ||
				current.requestId !== request.requestId ||
				current.requestedRevision !== request.requestedRevision
			)
				throw new MediaProcessingSupersededError();
			if (current.status === "completed") return;
			if (current.status === "failed")
				throw new Error(current.lastError ?? "Media task failed");
			if (Date.now() >= deadline)
				throw new Error("Media task is still pending; request remains queued");
			await new Promise<void>((resolve) => setTimeout(resolve, 250));
		}
	}
	async processTask(
		sourceId: string,
		mediaId: string,
		kind: FileTaskKind,
		force = false,
	) {
		const request = await this.requestTask(
			sourceId,
			mediaId,
			kind,
			force,
			undefined,
			true,
		);
		if (request) await this.wait(mediaId, kind, request);
	}
}
