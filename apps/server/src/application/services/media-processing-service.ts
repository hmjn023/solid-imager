/**
 * MediaProcessingService - Unified entry point for media registration and processing
 */

import path from "node:path";

// Registry for backward compatibility proxy

import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	Media,
	MediaMetadataContext,
} from "@solid-imager/core/domain/media/schemas";
// Repository Interfaces
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { TagRepository } from "@solid-imager/core/domain/repositories/tag-repository";
import type { CharacterServiceImpl } from "~/application/services/character-service";
import type { ServerConfigService } from "~/application/services/server-config-service";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import type { Job } from "~/infrastructure/db/schema";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { generateThumbnail } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";

export class MediaProcessingServiceImpl {
	private readonly sourceRepo: SourceRepository;
	private readonly mediaRepo: IMediaRepository;
	private readonly tagRepo: TagRepository;
	private readonly authorRepo: IAuthorRepository;
	private readonly characterService: CharacterServiceImpl;
	private readonly ipRepo: IIpRepository;
	private readonly projectRepo: IProjectRepository;
	private readonly jobRepo: IJobRepository;
	private readonly configService: ServerConfigService;

	constructor(
		sourceRepo: SourceRepository,
		mediaRepo: IMediaRepository,
		tagRepo: TagRepository,
		authorRepo: IAuthorRepository,
		characterService: CharacterServiceImpl,
		ipRepo: IIpRepository,
		projectRepo: IProjectRepository,
		jobRepo: IJobRepository,
		configService: ServerConfigService,
	) {
		this.sourceRepo = sourceRepo;
		this.mediaRepo = mediaRepo;
		this.tagRepo = tagRepo;
		this.authorRepo = authorRepo;
		this.characterService = characterService;
		this.ipRepo = ipRepo;
		this.projectRepo = projectRepo;
		this.jobRepo = jobRepo;
		this.configService = configService;
	}

	private get enableAutoTagging(): boolean {
		return this.configService.getConfig().jobs.enableAutoTagging;
	}

	/**
	 * Unified entry point for media registration and processing.
	 */
	async registerAndProcess(
		mediaSourceId: string,
		relativePath: string,
		contextMetadata?: Partial<MediaMetadataContext>,
	): Promise<Media> {
		const source = await this.sourceRepo.findById(mediaSourceId);
		if (!source || source.type !== "local") {
			throw new Error(
				`Source not found or not a local source: ${mediaSourceId}`,
			);
		}

		const basePath = (source.connectionInfo as { path: string }).path;
		const fullPath = path.join(basePath, relativePath);

		// Get file metadata
		const fileMetadata = await ServerMediaStorage.getFileMetadata(fullPath);

		// Determine media type
		const ext = path.extname(relativePath).toLowerCase();
		const extensions = this.configService.getConfig().media.supportedExtensions;
		let mediaType: "image" | "video" | "audio" = "image";
		if (extensions.video.includes(ext)) {
			mediaType = "video";
		} else if (extensions.audio.includes(ext)) {
			mediaType = "audio";
		}

		// Step 1: Create media record
		const media = await this.mediaRepo.create({
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
		});

		// Step 2: Register related data
		if (contextMetadata) {
			await this.registerContextMetadata(media.id, contextMetadata);
		}

		// Step 3: Queue processMedia job
		await this.jobRepo.create({
			type: "processMedia",
			mediaSourceId,
			payload: {
				mediaId: media.id,
				sourcePath: basePath,
				type: "processMedia",
			},
		});

		// Notify clients
		SseManager.sendEvent(mediaSourceId, "media-added", {
			mediaId: media.id,
			filePath: media.filePath,
		});

		return media;
	}

	/**
	 * Executes the processMedia job.
	 */
	async executeProcessMediaJob(job: Job): Promise<void> {
		if (job.type !== "processMedia") {
			return;
		}

		const payload = job.payload as any;
		const mediaId = payload?.mediaId;

		if (!mediaId) {
			logger.error({ jobId: job.id }, "Missing mediaId in job payload");
			return;
		}

		const media = await this.mediaRepo.findById(mediaId);
		if (!media) {
			logger.warn({ mediaId }, "Media not found for processMedia job");
			return;
		}

		const mediaPath = path.join(payload.sourcePath, media.filePath);

		const mediaSourceId = job.mediaSourceId;
		if (!mediaSourceId) {
			logger.error({ jobId: job.id }, "Missing mediaSourceId in job");
			return;
		}

		// Step 1: Metadata extraction
		if (!payload?.skipMetadataExtraction) {
			try {
				const metadata = await ImageProcessor.extractMetadata(mediaPath);

				await this.mediaRepo.upsertGenerationInfo(
					media.id,
					typeof metadata.prompt === "object"
						? JSON.stringify(metadata.prompt)
						: (metadata.prompt as string | null),
					metadata.workflow as object | null,
				);

				if (metadata.tags.length > 0) {
					await this.tagRepo.addTagsToMedia(
						media.id,
						metadata.tags,
						"comfyui_workflow",
					);
				}
			} catch (e) {
				logger.warn(
					{ err: e, mediaId },
					"Metadata extraction failed, continuing...",
				);
			}
		}

		// Step 2: Thumbnail generation
		try {
			await generateThumbnail(media, payload.sourcePath, mediaSourceId);
			SseManager.sendEvent(mediaSourceId, "thumbnail-generated", {
				mediaId: media.id,
			});
		} catch (e) {
			logger.error({ err: e, mediaId }, "Thumbnail generation failed");
		}

		// Step 3: AI tagging
		if (
			this.enableAutoTagging &&
			!payload?.skipMetadataExtraction &&
			media.mediaType === "image"
		) {
			try {
				await this.jobRepo.create({
					type: "auto_tagging",
					mediaSourceId,
					payload: {
						mediaId: media.id,
					},
				});
			} catch (e) {
				logger.warn({ err: e, mediaId }, "Failed to queue AI tagging job");
			}
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
					type: (t.type ?? "positive") as "positive" | "negative",
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
		const names = authors.map((a) => a.name);
		try {
			const allAuthors = await this.authorRepo.findOrCreateBulk(names, tx);
			const authorIds = allAuthors.map((a) => a.id);
			await this.authorRepo.addMediaBulk(mediaId, authorIds, tx);
		} catch (e) {
			logger.warn({ err: e }, "Failed to register authors");
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
			// Step 1: Collect all unique IP names from character data (linkedIps priority, fallback to currentIpNames)
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
			const charRepo = this.characterService.characterRepo;
			const existingChars: Character[] = await charRepo.findByNames(
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
			const newChars = await charRepo.findOrCreateBulk(
				bulkCharData,
				"manual",
				tx,
			);

			// Step 5: Bulk update IPs for existing characters
			if (charsToUpdateIps.length > 0) {
				await charRepo.updateIpsBulk(charsToUpdateIps, "manual", tx);
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

			await charRepo.addToMediaBulk(mediaId, charsToAddMedia, "manual", tx);

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
			logger.warn({ err: e }, "Failed to register characters");
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
			logger.warn({ err: e }, "Failed to register IPs");
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
			logger.warn({ err: e }, "Failed to register projects");
		}
	}

	/**
	 * Adds context metadata to an existing media item.
	 * This is useful when metadata becomes available after initial registration (e.g., from download).
	 */
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

		// Register related data using the shared private method
		await this.registerContextMetadata(mediaId, context, tx);
	}
}

// Backward compatibility proxy
export const MediaProcessingService = {
	registerAndProcess: async (
		mediaSourceId: string,
		relativePath: string,
		contextMetadata?: Partial<MediaMetadataContext>,
	) => {
		const { services } = await import("~/application/registry");
		return services
			.getMediaProcessingService()
			.registerAndProcess(mediaSourceId, relativePath, contextMetadata);
	},

	executeProcessMediaJob: async (job: Job) => {
		const { services } = await import("~/application/registry");
		return services.getMediaProcessingService().executeProcessMediaJob(job);
	},

	addContextMetadataToExistingMedia: async (
		mediaId: string,
		context: Partial<MediaMetadataContext>,
	) => {
		const { services } = await import("~/application/registry");
		return services
			.getMediaProcessingService()
			.addContextMetadataToExistingMedia(mediaId, context);
	},
};
