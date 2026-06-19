import path from "node:path";
import { isRecord } from "@solid-imager/core/utils/type-guards";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	Media,
	MediaMetadataContext,
} from "@solid-imager/core/domain/media/schemas";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { IJobRepository, Job } from "@solid-imager/core/domain/repositories/job-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { TagRepository } from "@solid-imager/core/domain/repositories/tag-repository";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IMediaStorage } from "@solid-imager/core/interfaces/media-storage";
import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import type { IMediaProcessingService } from "../ports/media-processing-service";

export type MediaProcessingServiceDeps = {
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
	logger?: { warn(msg: string, data?: unknown): void };
	enableAutoTagging: boolean;
	supportedExtensions: {
		image: string[];
		video: string[];
		audio: string[];
	};
	generateThumbnail: (
		media: { id: string; filePath: string },
		sourcePath: string,
		mediaSourceId: string,
	) => Promise<void>;
	sseSendEvent: (mediaSourceId: string, eventType: string, data: unknown) => void;
};

export class MediaProcessingServiceImpl implements IMediaProcessingService {
	private readonly sourceRepo: SourceRepository;
	private readonly mediaRepo: IMediaRepository;
	private readonly tagRepo: TagRepository;
	private readonly authorRepo: IAuthorRepository;
	private readonly characterRepo: CharacterRepository;
	private readonly ipRepo: IIpRepository;
	private readonly projectRepo: IProjectRepository;
	private readonly jobRepo: IJobRepository;
	private readonly imageProcessor: IImageProcessor;
	private readonly mediaStorage: IMediaStorage;
	private enableAutoTagging: boolean;
	private readonly supportedExtensions: MediaProcessingServiceDeps["supportedExtensions"];
	private readonly generateThumbnail: MediaProcessingServiceDeps["generateThumbnail"];
	private readonly sseSendEvent: MediaProcessingServiceDeps["sseSendEvent"];
	private readonly logger?: { warn(msg: string, data?: unknown): void };

	constructor(deps: MediaProcessingServiceDeps) {
		this.sourceRepo = deps.sourceRepo;
		this.mediaRepo = deps.mediaRepo;
		this.tagRepo = deps.tagRepo;
		this.authorRepo = deps.authorRepo;
		this.characterRepo = deps.characterRepo;
		this.ipRepo = deps.ipRepo;
		this.projectRepo = deps.projectRepo;
		this.jobRepo = deps.jobRepo;
		this.imageProcessor = deps.imageProcessor;
		this.mediaStorage = deps.mediaStorage;
		this.enableAutoTagging = deps.enableAutoTagging;
		this.supportedExtensions = deps.supportedExtensions;
		this.generateThumbnail = deps.generateThumbnail;
		this.sseSendEvent = deps.sseSendEvent;
		this.logger = deps.logger;
	}

	updateConfig(config: { enableAutoTagging: boolean }): void {
		this.enableAutoTagging = config.enableAutoTagging;
	}

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

		const connectionParse = localConnectionSchema.safeParse(source.connectionInfo);
		if (!connectionParse.success) {
			throw new Error("Invalid local source connection info: missing or invalid path");
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
		await this.jobRepo.createIfUnique({
			type: "sync_lancedb_delta",
			mediaSourceId,
			payload: { reason: "media_added", mediaIds: [media.id] },
		});

		// Notify clients
		this.sseSendEvent(mediaSourceId, "media-added", {
			mediaId: media.id,
			filePath: media.filePath,
		});

		return media;
	}

	async executeProcessMediaJob(job: Job): Promise<void> {
		if (job.type !== "processMedia") {
			return;
		}

		const payload = job.payload;
		if (!isRecord(payload)) {
			this.logger?.warn("Missing payload or invalid payload in job", { jobId: job.id });
			return;
		}
		const mediaId = payload.mediaId;
		if (typeof mediaId !== "string") {
			this.logger?.warn("Missing or invalid mediaId in job payload", { jobId: job.id });
			return;
		}

		const media = await this.mediaRepo.findById(mediaId);
		if (!media) {
			this.logger?.warn("Media not found for processMedia job", { mediaId });
			return;
		}

		const sourcePath = payload.sourcePath;
		if (typeof sourcePath !== "string") {
			this.logger?.warn("Missing or invalid sourcePath in job payload", { jobId: job.id });
			return;
		}
		const mediaPath = path.join(sourcePath, media.filePath);

		const mediaSourceId = job.mediaSourceId;
		if (!mediaSourceId) {
			this.logger?.warn("Missing mediaSourceId in job", { jobId: job.id });
			return;
		}

		// Step 1: Metadata extraction
		if (payload.skipMetadataExtraction !== true) {
			try {
				const metadata = await this.imageProcessor.extractMetadata(mediaPath);

				await this.mediaRepo.upsertGenerationInfo(
					media.id,
					typeof metadata.prompt === "object" && metadata.prompt !== null
						? JSON.stringify(metadata.prompt)
						: typeof metadata.prompt === "string"
							? metadata.prompt
							: null,
					isRecord(metadata.workflow) ? metadata.workflow : null,
				);

				if (metadata.tags.length > 0) {
					await this.tagRepo.addTagsToMedia(
						media.id,
						metadata.tags,
						"comfyui_workflow",
					);
				}
			} catch (e) {
				console.warn(
					{ err: e, mediaId },
					"Metadata extraction failed, continuing...",
				);
			}
		}

		// Step 2: Thumbnail generation
		try {
			await this.generateThumbnail(media, sourcePath, mediaSourceId);
			this.sseSendEvent(mediaSourceId, "thumbnail-generated", {
				mediaId: media.id,
			});
		} catch (e) {
			console.error({ err: e, mediaId }, "Thumbnail generation failed");
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
				console.warn({ err: e, mediaId }, "Failed to queue AI tagging job");
			}
		}

		await this.jobRepo.createIfUnique({
			type: "sync_lancedb_delta",
			mediaSourceId,
			payload: { reason: "media_processed", mediaIds: [media.id] },
		});
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
		const names = authors.map((a) => a.name);
		try {
			const allAuthors = await this.authorRepo.findOrCreateBulk(names, tx);
			const authorIds = allAuthors.map((a) => a.id);
			await this.authorRepo.addMediaBulk(mediaId, authorIds, tx);
		} catch (e) {
			console.warn({ err: e }, "Failed to register authors");
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

			await this.characterRepo.addToMediaBulk(mediaId, charsToAddMedia, "manual", tx);

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
			console.warn({ err: e }, "Failed to register characters");
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
			console.warn({ err: e }, "Failed to register IPs");
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
			console.warn({ err: e }, "Failed to register projects");
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
