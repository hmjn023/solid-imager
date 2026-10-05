import { createHash } from "node:crypto";
import path from "node:path";
import {
	JobAttemptLostError,
	mediaProcessingCheckpointSchema,
	processMediaPayloadSchema,
	type MediaProcessingCheckpoint,
	type ProcessingStep,
	type ProcessingStepKind,
} from "@solid-imager/core/domain/jobs/schemas";
import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type {
	Transaction,
	TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	Media,
	MediaMetadataContext,
} from "@solid-imager/core/domain/media/schemas";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type {
	IJobRepository,
	Job,
} from "@solid-imager/core/domain/repositories/job-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { IMediaProcessingStateRepository } from "@solid-imager/core/domain/repositories/media-processing-state-repository";
import type {
	MediaTaskKind,
	ProcessingOwner,
	ProcessingSettings,
} from "@solid-imager/core/domain/processing/schemas";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { TagRepository } from "@solid-imager/core/domain/repositories/tag-repository";
import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import type { SourceEventPublisher } from "@solid-imager/core/domain/sources/events";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import type { IMediaStorage } from "@solid-imager/core/interfaces/media-storage";
import { MediaTaskService } from "./media-task-service";
import type { IMediaProcessingService } from "../ports/media-processing-service";
import type { ILogger } from "../ports/media-service";

export type PreparedThumbnail = {
	commit: () => Promise<void>;
	cleanup: () => Promise<void>;
};

/** Indexed input identity; content hashes and processor-version invalidation belong to domain processing state. */
export function getMediaProcessingRevision(
	media: Pick<
		Media,
		"id" | "mediaSourceId" | "filePath" | "modifiedAt" | "fileSize"
	>,
	sourcePath: string,
): string {
	return createHash("sha256")
		.update(
			JSON.stringify([
				media.id,
				media.mediaSourceId,
				sourcePath,
				media.filePath,
				media.modifiedAt.toISOString(),
				media.fileSize,
			]),
		)
		.digest("hex");
}

export type MediaProcessingServiceDeps = {
	processingStateRepo: IMediaProcessingStateRepository;
	getProcessingSettings: () => ProcessingSettings;
	hasThumbnails: (sourceId: string, mediaId: string) => Promise<boolean>;
	transactionManager: TransactionManager;
	sourceRepo: SourceRepository;
	mediaRepo: IMediaRepository;
	tagRepo: TagRepository;
	authorRepo: IAuthorRepository;
	characterRepo: CharacterRepository;
	ipRepo: IIpRepository;
	projectRepo: IProjectRepository;
	jobRepo: IJobRepository;
	imageProcessor: IImageProcessor;
	mediaStorage: IMediaStorage;
	logger?: ILogger;
	enableAutoTagging: boolean;
	enableAutoCcipExtraction?: boolean;
	supportedExtensions: {
		image: string[];
		video: string[];
		audio: string[];
	};
	prepareThumbnail: (
		media: { id: string; filePath: string },
		sourcePath: string,
		mediaSourceId: string,
	) => Promise<PreparedThumbnail>;
	publishSourceEvent: SourceEventPublisher;
	publishJobProgress: (jobId: string, processed: number, total: number) => void;
};

export class MediaProcessingServiceImpl implements IMediaProcessingService {
	private readonly taskService: MediaTaskService;
	private readonly sourceRepo: SourceRepository;
	private readonly mediaRepo: IMediaRepository;
	private readonly tagRepo: TagRepository;
	private readonly authorRepo: IAuthorRepository;
	private readonly characterRepo: CharacterRepository;
	private readonly ipRepo: IIpRepository;
	private readonly projectRepo: IProjectRepository;
	private readonly jobRepo: IJobRepository;
	private readonly mediaStorage: IMediaStorage;
	private enableAutoTagging: boolean;
	private enableAutoCcipExtraction: boolean;
	private readonly supportedExtensions: MediaProcessingServiceDeps["supportedExtensions"];
	private readonly transactionManager: TransactionManager;
	private readonly publishSourceEvent: SourceEventPublisher;
	private readonly publishJobProgress: MediaProcessingServiceDeps["publishJobProgress"];
	private readonly logger?: ILogger;

	constructor(deps: MediaProcessingServiceDeps) {
		this.taskService = new MediaTaskService(deps);
		this.sourceRepo = deps.sourceRepo;
		this.mediaRepo = deps.mediaRepo;
		this.tagRepo = deps.tagRepo;
		this.authorRepo = deps.authorRepo;
		this.characterRepo = deps.characterRepo;
		this.ipRepo = deps.ipRepo;
		this.projectRepo = deps.projectRepo;
		this.jobRepo = deps.jobRepo;
		this.mediaStorage = deps.mediaStorage;
		this.enableAutoTagging = deps.enableAutoTagging;
		this.enableAutoCcipExtraction = deps.enableAutoCcipExtraction ?? false;
		this.supportedExtensions = deps.supportedExtensions;
		this.transactionManager = deps.transactionManager;
		this.publishSourceEvent = deps.publishSourceEvent;
		this.publishJobProgress = deps.publishJobProgress;
		this.logger = deps.logger;
	}

	updateConfig(config: {
		enableAutoTagging: boolean;
		enableAutoCcipExtraction: boolean;
	}): void {
		this.enableAutoTagging = config.enableAutoTagging;
		this.enableAutoCcipExtraction = config.enableAutoCcipExtraction;
	}

	async registerAndProcess(
		mediaSourceId: string,
		relativePath: string,
		contextMetadata?: Partial<MediaMetadataContext>,
	): Promise<Media> {
		const source = await this.sourceRepo.findById(mediaSourceId);
		if (source?.type !== "local") {
			throw new Error(
				`Source not found or not a local source: ${mediaSourceId}`,
			);
		}

		const connectionParse = localConnectionSchema.safeParse(
			source.connectionInfo,
		);
		if (!connectionParse.success) {
			throw new Error(
				"Invalid local source connection info: missing or invalid path",
			);
		}
		const basePath = connectionParse.data.path;
		const fullPath = path.join(basePath, relativePath);

		// Get file metadata
		const fileMetadata = await this.mediaStorage.getFileMetadata(fullPath);

		// Determine media type
		const ext = path.extname(relativePath).toLowerCase();
		const extensions = this.supportedExtensions;
		let mediaType: "image" | "video" | "audio" = "image";
		if (extensions.video.includes(ext)) {
			mediaType = "video";
		} else if (extensions.audio.includes(ext)) {
			mediaType = "audio";
		}

		const media = await this.transactionManager.transaction(async (tx) => {
			// Step 1: Create media record
			const media = await this.mediaRepo.create(
				{
					mediaSourceId,
					filePath: relativePath,
					fileName: path.basename(relativePath),
					mediaType,
					width: fileMetadata.width,
					height: fileMetadata.height,
					fileSize: fileMetadata.size,
					description: contextMetadata?.description ?? null,
					createdAt: contextMetadata?.createdAt ?? fileMetadata.createdAt,
					modifiedAt: fileMetadata.modifiedAt,
				},
				tx,
			);

			// Step 2: Register related data
			if (contextMetadata) {
				await this.registerContextMetadata(media.id, contextMetadata, tx);
			}

			// Step 3: Queue processMedia job
			await this.jobRepo.create(
				{
					type: "processMedia",
					mediaSourceId,
					payload: {
						mediaId: media.id,
						sourcePath: basePath,
						type: "processMedia",
					},
				},
				tx,
			);

			return media;
		});

		// Notify clients
		this.notify(() =>
			this.publishSourceEvent(mediaSourceId, "media-added", {
				mediaId: media.id,
				filePath: media.filePath,
			}),
		);

		return media;
	}

	async executeProcessMediaJob(job: Job): Promise<void> {
		if (job.type !== "processMedia")
			throw new Error("Expected processMedia job");
		const payload = processMediaPayloadSchema.parse(job.payload);
		const media = await this.mediaRepo.findById(payload.mediaId);
		if (!media || media.mediaSourceId !== job.mediaSourceId) {
			throw new Error("Processing target no longer exists in this source");
		}
		const source = await this.sourceRepo.findById(media.mediaSourceId);
		if (source?.type !== "local")
			throw new Error("Local processing source not found");
		const sourcePath = localConnectionSchema.parse(source.connectionInfo).path;
		const revisionOf = (media: Media) =>
			getMediaProcessingRevision(media, sourcePath);
		const inputRevision = revisionOf(media);
		const previous = mediaProcessingCheckpointSchema.safeParse(
			job.processingCheckpoint,
		);
		const step = (skip: boolean): ProcessingStep => ({
			status: skip ? "skipped" : "pending",
			attemptCount: 0,
			updatedAt: null,
		});
		const checkpoint: MediaProcessingCheckpoint =
			previous.success && previous.data.inputRevision === inputRevision
				? previous.data
				: {
						version: 1,
						inputRevision,
						steps: {
							metadata: step(payload.skipMetadataExtraction === true),
							thumbnail: step(
								payload.skipThumbnailGeneration === true ||
									media.mediaType === "audio",
							),
							ai_dispatch: step(
								media.mediaType !== "image" ||
									(!(
										this.enableAutoTagging && !payload.skipMetadataExtraction
									) &&
										!this.enableAutoCcipExtraction),
							),
						},
					};
		const save = async (tx: Transaction) => {
			await this.jobRepo.update(
				job.id,
				{ processingCheckpoint: checkpoint },
				tx,
			);
		};
		const active = async <T>(action: (tx: Transaction) => Promise<T>) => {
			const result = await this.jobRepo.withActiveAttempt(
				job.id,
				job.attemptCount ?? 0,
				action,
			);
			const steps = Object.values(checkpoint.steps);
			this.notify(() =>
				this.publishJobProgress(
					job.id,
					steps.filter(
						(entry) =>
							entry.status === "completed" || entry.status === "skipped",
					).length,
					steps.length,
				),
			);
			return result;
		};
		await active(save);

		const failures: ProcessingStepKind[] = [];
		const run = async (kind: ProcessingStepKind, work: () => Promise<void>) => {
			const current = checkpoint.steps[kind];
			if (current.status === "completed" || current.status === "skipped")
				return;
			current.status = "in_progress";
			current.attemptCount++;
			current.updatedAt = new Date().toISOString();
			await active(save);
			try {
				await work();
			} catch (error) {
				if (error instanceof JobAttemptLostError) throw error;
				current.status = "failed";
				current.updatedAt = new Date().toISOString();
				await active(save);
				failures.push(kind);
				this.logger?.error(
					{ err: error, jobId: job.id, mediaId: media.id, step: kind },
					"Media processing step failed",
				);
			}
		};
		const complete = async (
			kind: ProcessingStepKind,
			action: (tx: Transaction) => Promise<void>,
		) => {
			await active(async (tx) => {
				const currentMedia = await this.mediaRepo.findById(media.id, tx, {
					forUpdate: true,
				});
				if (!currentMedia || revisionOf(currentMedia) !== inputRevision) {
					throw new Error(
						"Media changed during processing; retry with its current revision",
					);
				}
				await action(tx);
				checkpoint.steps[kind].status = "completed";
				checkpoint.steps[kind].updatedAt = new Date().toISOString();
				await save(tx);
			});
		};

		for (const kind of ["metadata", "thumbnail"] as const) {
			if (checkpoint.steps[kind].status === "skipped") continue;
			try {
				await this.taskService.execute(
					{
						mediaId: media.id,
						mediaSourceId: media.mediaSourceId,
						sourcePath,
						filePath: media.filePath,
						modifiedAt: media.modifiedAt,
						fileSize: media.fileSize,
						mediaType: media.mediaType,
					},
					kind,
					{ jobId: job.id, attemptCount: job.attemptCount ?? 0 },
					{
						claimed: async (tx) => {
							const step = checkpoint.steps[kind];
							step.status = "in_progress";
							step.attemptCount++;
							step.updatedAt = new Date().toISOString();
							await save(tx);
						},
						completed: async (tx) => {
							checkpoint.steps[kind].status = "completed";
							checkpoint.steps[kind].updatedAt = new Date().toISOString();
							await save(tx);
						},
						changed: () =>
							this.notify(() =>
								this.publishJobProgress(
									job.id,
									Object.values(checkpoint.steps).filter(
										(step) =>
											step.status === "completed" || step.status === "skipped",
									).length,
									3,
								),
							),
					},
				);
			} catch (error) {
				if (error instanceof JobAttemptLostError) throw error;
				checkpoint.steps[kind].status = "failed";
				checkpoint.steps[kind].updatedAt = new Date().toISOString();
				await active(save);
				failures.push(kind);
				this.logger?.error(
					{ err: error, jobId: job.id, step: kind },
					"Media processing step failed",
				);
			}
		}

		await run("ai_dispatch", async () => {
			await complete("ai_dispatch", async (tx) => {
				if (this.enableAutoTagging && !payload.skipMetadataExtraction) {
					await this.jobRepo.create(
						{
							type: "auto_tagging",
							mediaSourceId: media.mediaSourceId,
							payload: { mediaId: media.id },
						},
						tx,
					);
				}
				if (this.enableAutoCcipExtraction) {
					await this.jobRepo.createIfUnique(
						{
							type: "extract_ccip_vector",
							mediaSourceId: media.mediaSourceId,
							payload: { mediaId: media.id },
						},
						tx,
					);
				}
			});
		});
		if (failures.length > 0)
			throw new Error(`Media processing failed: ${failures.join(", ")}`);
	}

	processTask(
		sourceId: string,
		mediaId: string,
		kind: Exclude<MediaTaskKind, "tagging">,
		owner?: ProcessingOwner,
		force = false,
	): Promise<void> {
		return this.taskService.processTask(sourceId, mediaId, kind, owner, force);
	}

	private notify(publish: () => void): void {
		try {
			publish();
		} catch (error) {
			// Notifications are hints; a listener failure cannot undo committed work.
			this.logger?.warn(
				{ err: error },
				"Failed to publish media processing event",
			);
		}
	}

	private async registerContextMetadata(
		mediaId: string,
		context: Partial<MediaMetadataContext>,
		tx?: Transaction,
	): Promise<void> {
		if (context.sourceUrls?.length) {
			await this.mediaRepo.addUrls(mediaId, context.sourceUrls, tx);
		}

		if (context.authors?.length) {
			await this.registerAuthors(mediaId, context.authors, tx);
		}

		if (context.tags?.length) {
			await this.tagRepo.addTagsToMedia(
				mediaId,
				context.tags.map((t) => ({
					name: t.name,
					type: t.type === "negative" ? "negative" : "positive",
					confidence: t.confidence ?? undefined,
				})),
				"user_provided",
				tx,
			);
		}

		if (context.ips?.length) {
			await this.registerIps(mediaId, context.ips, tx);
		}

		if (context.characters?.length) {
			await this.registerCharacters(
				mediaId,
				context.characters,
				context.ips?.map((ip) => ip.name),
				tx,
			);
		}

		if (context.projects?.length) {
			await this.registerProjects(mediaId, context.projects, tx);
		}
	}

	private async registerAuthors(
		mediaId: string,
		authors: NonNullable<MediaMetadataContext["authors"]>,
		tx?: Transaction,
	): Promise<void> {
		if (authors.length === 0) {
			return;
		}
		try {
			const allAuthors = await this.authorRepo.findOrCreateBulk(authors, tx);
			const authorIds = allAuthors.map((a) => a.id);
			await this.authorRepo.addMediaBulk(mediaId, authorIds, tx);
		} catch (e) {
			this.logger?.warn({ err: e }, "Failed to register authors");
			if (tx) throw e;
		}
	}

	private async registerCharacters(
		mediaId: string,
		characters: NonNullable<MediaMetadataContext["characters"]>,
		currentIpNames?: string[],
		tx?: Transaction,
	): Promise<void> {
		if (characters.length === 0) {
			return;
		}

		try {
			// Step 1: Collect all unique IP names from character data
			const allIpNamesSet = new Set<string>();
			for (const charData of characters) {
				const ipNames =
					charData.linkedIps && charData.linkedIps.length > 0
						? charData.linkedIps
						: (currentIpNames ?? []);
				for (const name of ipNames) {
					allIpNamesSet.add(name);
				}
			}

			// Resolve all IP IDs in one query
			const allIpNames = [...allIpNamesSet];
			const allIpNameIdMap = new Map<string, string>();
			if (allIpNames.length > 0) {
				const foundIps = await this.ipRepo.findByNames(allIpNames, tx);
				for (const ip of foundIps) {
					allIpNameIdMap.set(ip.name, ip.id);
				}
			}

			// Step 2: Map character data to IP IDs and find existing characters
			const charNameIpIdsMap = new Map<string, string[]>();
			for (const charData of characters) {
				const ipNames =
					charData.linkedIps && charData.linkedIps.length > 0
						? charData.linkedIps
						: (currentIpNames ?? []);
				const ipIds: string[] = [];
				for (const name of ipNames) {
					const ipId = allIpNameIdMap.get(name);
					if (ipId) {
						ipIds.push(ipId);
					}
				}
				charNameIpIdsMap.set(charData.name, ipIds);
			}

			const charNames = characters.map((c) => c.name);
			const existingChars: Character[] = await this.characterRepo.findByNames(
				charNames,
				tx,
			);
			const existingCharMap = new Map(existingChars.map((c) => [c.name, c]));

			// Step 3: Build data for bulk findOrCreateBulk and IP updates
			const bulkCharData: Array<{ name: string; ipIds: string[] }> = [];
			const charsToUpdateIps: Array<{
				id: string;
				ipIds: string[];
			}> = [];

			for (const charData of characters) {
				const ipIds = charNameIpIdsMap.get(charData.name) ?? [];
				const existing = existingCharMap.get(charData.name);

				if (!existing) {
					bulkCharData.push({ name: charData.name, ipIds });
				} else if (ipIds.length > 0) {
					const existingIpIds = existing.ips?.map((i) => i.id) || [];
					const mergedIpIds = [...new Set([...existingIpIds, ...ipIds])];
					if (mergedIpIds.length > existingIpIds.length) {
						charsToUpdateIps.push({
							id: existing.id,
							ipIds: mergedIpIds,
						});
					}
				}
			}

			// Step 4: Bulk create new characters
			const newChars = await this.characterRepo.findOrCreateBulk(
				bulkCharData,
				"manual",
				tx,
			);

			// Step 5: Bulk update IPs for existing characters
			if (charsToUpdateIps.length > 0) {
				await this.characterRepo.updateIpsBulk(charsToUpdateIps, "manual", tx);
			}

			// Step 6: Bulk add characters to media
			const allChars = [...existingChars, ...newChars];
			const confidenceMap = new Map(
				characters.map((c) => [c.name, c.confidence]),
			);
			const charsToAddMedia = allChars.map((char) => ({
				id: char.id,
				confidence: confidenceMap.get(char.name) ?? 1,
			}));

			await this.characterRepo.addToMediaBulk(
				mediaId,
				charsToAddMedia,
				"manual",
				tx,
			);

			// Step 7: Bulk link character IPs to media
			const ipIdsSeen = new Set<string>();
			for (const char of allChars) {
				if (char.ips) {
					for (const ip of char.ips) {
						ipIdsSeen.add(ip.id);
					}
				}
			}
			const allIpIdsToLink = [...ipIdsSeen].map((id) => ({ id }));

			if (allIpIdsToLink.length > 0) {
				await this.ipRepo.addMediaBulk(
					mediaId,
					allIpIdsToLink,
					"character_link",
					tx,
				);
			}
		} catch (e) {
			this.logger?.warn({ err: e }, "Failed to register characters");
			if (tx) throw e;
		}
	}

	private async registerIps(
		mediaId: string,
		ipsData: NonNullable<MediaMetadataContext["ips"]>,
		tx?: Transaction,
	): Promise<void> {
		// Normalize names and remove duplicates
		const normalizedIpsMap = new Map<
			string,
			NonNullable<MediaMetadataContext["ips"]>[number]
		>();
		for (const ip of ipsData) {
			const normalizedName = ip.name.trim();
			if (!normalizedName) continue;
			if (!normalizedIpsMap.has(normalizedName)) {
				normalizedIpsMap.set(normalizedName, ip);
			}
		}

		if (normalizedIpsMap.size === 0) {
			return;
		}

		try {
			const names = [...normalizedIpsMap.keys()];
			const allIps = await this.ipRepo.findOrCreateBulk(names, "manual", tx);

			// Build bulk media linkage with confidence from original data
			const ipsToLink = allIps.map((ip) => ({
				id: ip.id,
				confidence: normalizedIpsMap.get(ip.name)?.confidence ?? undefined,
			}));

			await this.ipRepo.addMediaBulk(mediaId, ipsToLink, "manual", tx);
		} catch (e) {
			this.logger?.warn({ err: e }, "Failed to register IPs");
			if (tx) throw e;
		}
	}

	private async registerProjects(
		mediaId: string,
		projectsData: NonNullable<MediaMetadataContext["projects"]>,
		tx?: Transaction,
	): Promise<void> {
		if (projectsData.length === 0) {
			return;
		}
		const names = projectsData.map((p) => p.name);
		try {
			const allProjects = await this.projectRepo.findOrCreateBulk(names, tx);
			const projectIds = allProjects.map((p) => p.id);
			await this.projectRepo.addMediaBulk(mediaId, projectIds, tx);
		} catch (e) {
			this.logger?.warn({ err: e }, "Failed to register projects");
			if (tx) throw e;
		}
	}

	async addContextMetadataToExistingMedia(
		mediaId: string,
		context: Partial<MediaMetadataContext>,
		tx?: Transaction,
	): Promise<void> {
		const media = await this.mediaRepo.findById(mediaId, tx);
		if (!media) {
			throw new Error(`Media not found: ${mediaId}`);
		}

		// Update description if provided
		if (context.description) {
			await this.mediaRepo.update(
				mediaId,
				{
					description: context.description,
				},
				tx,
			);
		}

		// Register related data
		await this.registerContextMetadata(mediaId, context, tx);
	}
}
