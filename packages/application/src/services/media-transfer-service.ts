import path from "node:path";
import type { IMediaStorage } from "@solid-imager/core";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type {
	Transaction,
	TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	type AddMediaRequest,
	type Media,
	mediaIdSchema,
	mediaSourceIdSchema,
	updateMediaRequestSchema,
} from "@solid-imager/core/domain/media/schemas";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { IJobRepository } from "@solid-imager/core/domain/repositories/job-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import type {
	DeferredActions,
	DeferredSourceEvent,
	IDeferredActionExecutor,
	ILogger,
	IMediaContextProcessor,
	ISourceEventPublisher,
	IThumbnailManager,
} from "../ports/media-service";

export class MediaTransferService {
	constructor(
		private readonly mediaRepository: IMediaRepository,
		private readonly sourceRepository: SourceRepository,
		private readonly storageService: IMediaStorage,
		private readonly authorRepository: IAuthorRepository,
		private readonly projectRepository: IProjectRepository,
		private readonly characterRepository: CharacterRepository,
		private readonly ipRepository: IIpRepository,
		private readonly transactionManager: TransactionManager,
		private readonly jobRepo: IJobRepository,
		private readonly eventPublisher: ISourceEventPublisher,
		private readonly thumbnailManager: IThumbnailManager,
		private readonly logger: ILogger,
		private readonly deferredActionExecutor: IDeferredActionExecutor,
		private readonly mediaContextProcessor: IMediaContextProcessor,
	) {}

	async updateMedia(
		mediaSourceId: string,
		mediaId: string,
		updates: unknown,
		tx?: Transaction,
	): Promise<Media> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);
		const parsedUpdates = updateMediaRequestSchema.parse(updates);

		const execute = async (t: Transaction): Promise<Media> => {
			const media = await this.mediaRepository.findById(validatedMediaId, t);
			if (!media || media.mediaSourceId !== validatedSourceId) {
				throw new ResourceNotFoundError("Media", validatedMediaId);
			}

			const updatedMedia = await this.mediaRepository.update(
				validatedMediaId,
				parsedUpdates,
				t,
			);
			await this.mediaContextProcessor.addContextMetadataToExistingMedia(
				validatedMediaId,
				{
					sourceUrls: parsedUpdates.sourceUrls,
					authors: parsedUpdates.authors,
					characters: parsedUpdates.characters,
					ips: parsedUpdates.ips,
				},
				t,
			);

			return updatedMedia;
		};

		if (tx) {
			return await execute(tx);
		}
		const updatedMedia = await this.transactionManager.transaction(execute);
		await this.jobRepo.createIfUnique({
			type: "sync_lancedb_delta",
			mediaSourceId: validatedSourceId,
			payload: { reason: "media_updated", mediaIds: [validatedMediaId] },
		});
		return updatedMedia;
	}

	async copyMedia(
		sourceMediaId: string,
		targetSourceId: string,
		tx?: Transaction,
	): Promise<{ success: boolean; media: Media; deferred?: DeferredActions }> {
		const validatedSourceMediaId = mediaIdSchema.parse(sourceMediaId);
		const validatedTargetSourceId = mediaSourceIdSchema.parse(targetSourceId);

		const sourceMedia = await this.mediaRepository.findById(
			validatedSourceMediaId,
			tx,
		);
		if (!sourceMedia) {
			throw new ResourceNotFoundError("Source Media", validatedSourceMediaId);
		}

		const sourceSource = await this.sourceRepository.findById(
			sourceMedia.mediaSourceId,
			tx,
		);
		const targetSource = await this.sourceRepository.findById(
			validatedTargetSourceId,
			tx,
		);

		if (!(sourceSource && targetSource)) {
			throw new Error("Source or target media source not found.");
		}

		if (sourceSource.type !== "local" || targetSource.type !== "local") {
			throw new Error("Only local-to-local copy is supported in this version.");
		}

		const sourceConnection = localConnectionSchema.parse(
			sourceSource.connectionInfo,
		);
		const targetConnection = localConnectionSchema.parse(
			targetSource.connectionInfo,
		);
		const fullSourcePath = path.join(
			sourceConnection.path,
			sourceMedia.filePath,
		);

		const fileInfo = await this.storageService.copyFile(
			fullSourcePath,
			targetConnection.path,
			{
				filename: sourceMedia.fileName,
				autoIncrement: true,
			},
		);

		const newMedia: AddMediaRequest = {
			mediaSourceId: validatedTargetSourceId,
			filePath: fileInfo.filePath,
			fileName: fileInfo.fileName,
			mediaType: sourceMedia.mediaType,
			width: fileInfo.width,
			height: fileInfo.height,
			fileSize: fileInfo.size,
			description: sourceMedia.description,
			createdAt: sourceMedia.createdAt,
			modifiedAt: sourceMedia.modifiedAt,
		};

		let newMediaEntry: Media;
		try {
			newMediaEntry = await this.mediaRepository.create(newMedia, tx);
			await this.copyMediaMetadata(
				validatedSourceMediaId,
				newMediaEntry.id,
				tx,
			);
		} catch (error) {
			try {
				await this.storageService.deleteFile(
					targetConnection.path,
					fileInfo.filePath,
				);
			} catch (_deleteError) {
				this.logger.error(
					{ err: _deleteError, filePath: fileInfo.filePath },
					"Failed to clean up copied file after DB failure",
				);
			}
			throw error;
		}

		const sourcePath = targetConnection.path;
		const deferredJob = {
			mediaId: newMediaEntry.id,
			sourcePath,
			type: "processMedia" as const,
			payload: {
				mediaId: newMediaEntry.id,
				sourcePath,
				type: "processMedia",
			},
		};
		const deferredSyncJob = {
			type: "sync_lancedb_delta" as const,
			payload: { reason: "media_added", mediaIds: [newMediaEntry.id] },
		};

		const deferredActions: DeferredActions = {
			jobs: [
				{
					mediaSourceId: validatedTargetSourceId,
					jobs: [deferredJob, deferredSyncJob],
				},
			],
			sourceEvents: [],
		};

		const sourceEvent: DeferredSourceEvent = {
			mediaSourceId: validatedTargetSourceId,
			event: "media-copied",
			payload: {
				sourceMediaId,
				media: newMediaEntry,
				timestamp: new Date().toISOString(),
			},
		};

		if (tx) {
			deferredActions.sourceEvents.push(sourceEvent);
			return {
				success: true,
				media: newMediaEntry,
				deferred: deferredActions,
			};
		}

		await this.jobRepo.create({
			type: "processMedia",
			mediaSourceId: validatedTargetSourceId,
			payload: {
				mediaId: newMediaEntry.id,
				sourcePath,
				type: "processMedia",
			},
		});
		await this.jobRepo.createIfUnique({
			type: "sync_lancedb_delta",
			mediaSourceId: validatedTargetSourceId,
			payload: { reason: "media_added", mediaIds: [newMediaEntry.id] },
		});

		this.eventPublisher.notifyMediaCopied(
			sourceMediaId,
			validatedTargetSourceId,
			newMediaEntry,
		);

		return {
			success: true,
			media: newMediaEntry,
		};
	}

	async moveMedia(
		sourceMediaId: string,
		targetSourceId: string,
		tx?: Transaction,
	): Promise<{ success: boolean; media: Media; deferred?: DeferredActions }> {
		const execute = async (t: Transaction) => {
			const accumulatedDeferred: DeferredActions = {
				jobs: [],
				sourceEvents: [],
			};

			let copiedFileCleanup: { targetPath: string; filePath: string } | null =
				null;

			try {
				const copyResult = await this.copyMedia(
					sourceMediaId,
					targetSourceId,
					t,
				);
				if (copyResult.deferred) {
					accumulatedDeferred.jobs.push(...copyResult.deferred.jobs);
				}

				if (copyResult.success) {
					const targetSource = await this.sourceRepository.findById(
						targetSourceId,
						t,
					);
					if (targetSource?.type === "local") {
						const conn = localConnectionSchema.parse(
							targetSource.connectionInfo,
						);
						copiedFileCleanup = {
							targetPath: conn.path,
							filePath: copyResult.media.filePath,
						};
					}

					const sourceMedia = await this.mediaRepository.findById(
						sourceMediaId,
						t,
					);
					if (sourceMedia) {
						const deleteResult = await this.deleteMedia(
							sourceMedia.mediaSourceId,
							sourceMediaId,
							t,
						);
						if (deleteResult) {
							accumulatedDeferred.jobs.push(...deleteResult.jobs);
							if (deleteResult.filesToDelete) {
								accumulatedDeferred.filesToDelete = [
									...(accumulatedDeferred.filesToDelete ?? []),
									...deleteResult.filesToDelete,
								];
							}
							if (deleteResult.thumbnailsToDelete) {
								accumulatedDeferred.thumbnailsToDelete = [
									...(accumulatedDeferred.thumbnailsToDelete ?? []),
									...deleteResult.thumbnailsToDelete,
								];
							}
						}

						const sourceEvent: DeferredSourceEvent = {
							mediaSourceId: sourceMedia.mediaSourceId,
							event: "media-moved",
							payload: {
								type: "source",
								mediaId: sourceMediaId,
								targetId: targetSourceId,
								timestamp: new Date().toISOString(),
							},
						};
						const targetEvent: DeferredSourceEvent = {
							mediaSourceId: targetSourceId,
							event: "media-moved",
							payload: {
								type: "target",
								media: copyResult.media,
								sourceId: sourceMedia.mediaSourceId,
								timestamp: new Date().toISOString(),
							},
						};
						accumulatedDeferred.sourceEvents.push(sourceEvent, targetEvent);
					}
				}
				return {
					...copyResult,
					deferred: accumulatedDeferred,
				};
			} catch (error) {
				if (copiedFileCleanup) {
					try {
						await this.storageService.deleteFile(
							copiedFileCleanup.targetPath,
							copiedFileCleanup.filePath,
						);
					} catch {
						// Ignore cleanup errors
					}
				}
				throw error;
			}
		};

		if (tx) {
			return await execute(tx);
		}

		const result = await this.transactionManager.transaction(execute);

		if (result.deferred) {
			await this.deferredActionExecutor.execute(result.deferred);
		}

		return result;
	}

	async deleteMedia(
		mediaSourceId: string,
		mediaId: string,
		tx?: Transaction,
	): Promise<DeferredActions | undefined> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);

		const media = await this.mediaRepository.findById(validatedMediaId, tx);
		if (!media) {
			throw new ResourceNotFoundError("Media", validatedMediaId);
		}
		if (media.mediaSourceId !== validatedSourceId) {
			throw new Error("Media not in specified source");
		}

		await this.mediaRepository.delete(validatedMediaId, tx);

		let filesToDelete: DeferredActions["filesToDelete"];
		if (media.mediaSourceId) {
			const mediaSource = await this.sourceRepository.findById(
				media.mediaSourceId,
				tx,
			);
			if (mediaSource && mediaSource.type === "local") {
				const connectionInfo = localConnectionSchema.parse(
					mediaSource.connectionInfo,
				);
				filesToDelete = [
					{ basePath: connectionInfo.path, filePath: media.filePath },
				];
			}
		}

		const thumbnailsToDelete: DeferredActions["thumbnailsToDelete"] = [
			{ mediaSourceId: validatedSourceId, mediaId: validatedMediaId },
		];

		const sourceEvent: DeferredSourceEvent = {
			mediaSourceId: validatedSourceId,
			event: "media-deleted",
			payload: {
				filePath: media.filePath,
				timestamp: new Date().toISOString(),
			},
		};

		if (tx) {
			return {
				jobs: [
					{
						mediaSourceId: validatedSourceId,
						jobs: [
							{
								type: "sync_lancedb_delta",
								payload: {
									reason: "media_deleted",
									operation: "delete",
									mediaIds: [validatedMediaId],
								},
							},
						],
					},
				],
				sourceEvents: [sourceEvent],
				filesToDelete,
				thumbnailsToDelete,
			};
		}

		await this.jobRepo.createIfUnique({
			type: "sync_lancedb_delta",
			mediaSourceId: validatedSourceId,
			payload: {
				reason: "media_deleted",
				operation: "delete",
				mediaIds: [validatedMediaId],
			},
		});

		if (thumbnailsToDelete) {
			for (const thumb of thumbnailsToDelete) {
				try {
					await this.thumbnailManager.deleteThumbnail(
						thumb.mediaSourceId,
						thumb.mediaId,
					);
				} catch (_e) {
					// Log error
				}
			}
		}
		if (filesToDelete) {
			for (const file of filesToDelete) {
				try {
					await this.storageService.deleteFile(file.basePath, file.filePath);
				} catch (_e) {
					// Log error
				}
			}
		}

		this.eventPublisher.publishSource(
			sourceEvent.mediaSourceId,
			sourceEvent.event,
			sourceEvent.payload,
		);
	}

	private async copyMediaMetadata(
		sourceMediaId: string,
		newMediaId: string,
		tx?: Transaction,
	): Promise<void> {
		const sourceAuthors = await this.mediaRepository.getAuthors(
			sourceMediaId,
			tx,
		);
		if (sourceAuthors.length > 0) {
			await this.authorRepository.addMediaBulk(
				newMediaId,
				sourceAuthors.map((a: { id: string }) => a.id),
				tx,
			);
		}

		const sourceProjects = await this.projectRepository.findByMediaId(
			sourceMediaId,
			tx,
		);
		if (sourceProjects.length > 0) {
			await this.projectRepository.addMediaBulk(
				newMediaId,
				sourceProjects.map((p: { id: string }) => p.id),
				tx,
			);
		}

		const sourceCharacters = await this.characterRepository.findByMediaId(
			sourceMediaId,
			tx,
		);
		if (sourceCharacters.length > 0) {
			await this.characterRepository.addToMediaBulk(
				newMediaId,
				sourceCharacters.map((c: { id: string }) => ({ id: c.id })),
				"manual",
				tx,
			);
		}

		const sourceIps = await this.ipRepository.findByMediaId(sourceMediaId, tx);
		if (sourceIps.length > 0) {
			await this.ipRepository.addMediaBulk(
				newMediaId,
				sourceIps.map((i: { id: string }) => ({ id: i.id })),
				"manual",
				tx,
			);
		}

		const sourceUrls = await this.mediaRepository.getUrls(sourceMediaId, tx);
		if (sourceUrls.length > 0) {
			await this.mediaRepository.addUrls(
				newMediaId,
				sourceUrls.map((u: { url: string }) => u.url),
				tx,
			);
		}
	}
}
