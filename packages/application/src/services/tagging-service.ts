import path from "node:path";
import type {
	Transaction,
	TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { ProcessingOwner } from "@solid-imager/core/domain/processing/schemas";
import type { IJobRepository } from "@solid-imager/core/domain/repositories/job-repository";
import type { IMediaProcessingStateRepository } from "@solid-imager/core/domain/repositories/media-processing-state-repository";
import { TaggingTaskService } from "./tagging-task-service";
import type { IAiClient } from "@solid-imager/core/domain/interfaces/ai-client";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { TagRepository as TagRepositoryDef } from "@solid-imager/core/domain/repositories/tag-repository";
import type { SourceEventPublisher } from "@solid-imager/core/domain/sources/events";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import type {
	CcipFeatureResponse,
	TaggingResponse,
} from "@solid-imager/core/domain/tagging/schemas";
import type { ILogger } from "../ports/media-service";
import type { ITaggingService } from "../ports/tagging-service";

export type TaggingServiceDeps = {
	processingStateRepo: IMediaProcessingStateRepository;
	transactionManager: TransactionManager;
	jobRepo: IJobRepository;
	aiClient: IAiClient;
	sourceRepo: SourceRepository;
	mediaRepo: IMediaRepository;
	tagRepo: TagRepositoryDef;
	characterRepo: CharacterRepository;
	ipRepo: IIpRepository;
	logger?: ILogger;
	publishSourceEvent: SourceEventPublisher;
	readFileBuffer: (filePath: string) => Promise<ArrayBuffer>;
};

export class TaggingServiceImpl implements ITaggingService {
	private readonly aiClient: IAiClient;
	private readonly tasks: TaggingTaskService;
	private readonly sourceRepo: SourceRepository;
	private readonly mediaRepo: IMediaRepository;
	private readonly tagRepo: TagRepositoryDef;
	private readonly characterRepo: CharacterRepository;
	private readonly ipRepo: IIpRepository;
	private readonly publishSourceEvent: SourceEventPublisher;
	private readonly readFileBuffer: (filePath: string) => Promise<ArrayBuffer>;
	private readonly logger?: ILogger;

	constructor(deps: TaggingServiceDeps) {
		this.aiClient = deps.aiClient;
		this.tasks = new TaggingTaskService({
			...deps,
			getTaggingSettings: () => deps.aiClient.getTaggingSettings(),
		});
		this.sourceRepo = deps.sourceRepo;
		this.mediaRepo = deps.mediaRepo;
		this.tagRepo = deps.tagRepo;
		this.characterRepo = deps.characterRepo;
		this.ipRepo = deps.ipRepo;
		this.publishSourceEvent = deps.publishSourceEvent;
		this.readFileBuffer = deps.readFileBuffer;
		this.logger = deps.logger;
	}

	async isServiceAvailable(): Promise<boolean> {
		return await this.aiClient.healthCheck();
	}

	async getTags(imageBuffer: ArrayBuffer): Promise<TaggingResponse> {
		return await this.aiClient.tagImage(imageBuffer);
	}

	async getTagsForMedia(
		mediaSourceId: string,
		mediaId: string,
		options?: { skipCache?: boolean; owner?: ProcessingOwner },
	): Promise<TaggingResponse | null> {
		const media = await this.mediaRepo.findById(mediaId);
		if (!media || media.mediaSourceId !== mediaSourceId)
			throw new Error("Media not found in source");
		if (media.mediaType !== "image")
			return {
				general: {},
				character: {},
				attributes: {},
				ips: [],
				ips_mapping: {},
			};
		const source = await this.sourceRepo.findById(mediaSourceId);
		if (!source) throw new Error("Media source not found");
		if (source.type !== "local") return null;
		const input = {
			mediaId,
			mediaSourceId,
			mediaType: media.mediaType,
			sourcePath: localConnectionSchema.parse(source.connectionInfo).path,
			filePath: media.filePath,
			modifiedAt: media.modifiedAt,
			fileSize: media.fileSize,
		};
		const fullPath = path.join(input.sourcePath, input.filePath);
		const { response, reused } = await this.tasks.execute(
			input,
			async () =>
				this.isAiServiceLocal()
					? this.aiClient.tagImageByPath(fullPath)
					: this.aiClient.tagImage(await this.readFileBuffer(fullPath)),
			(result, tx) => this.saveTags(mediaId, result, tx),
			options?.owner,
			options?.skipCache,
		);
		if (!reused) {
			try {
				this.publishSourceEvent(mediaSourceId, "media-changed", {
					filePath: media.filePath,
					mediaId,
					timestamp: new Date().toISOString(),
				});
			} catch (error) {
				this.logger?.warn(
					{ err: error, mediaId },
					"Failed to publish tagging update",
				);
			}
		}
		return response;
	}

	private async saveTags(
		mediaId: string,
		response: TaggingResponse,
		tx: Transaction,
	): Promise<void> {
		await this.tagRepo.removeTagsFromSource(mediaId, "AI", tx);
		await this.characterRepo.removeMediaFromSource(mediaId, "AI", tx);
		await this.ipRepo.removeMediaFromSource(mediaId, "AI", tx);

		// 1. Tags
		const tagsToInsert = Object.entries(response.general).map(
			([name, confidence]) => ({
				name,
				type: "positive" as const,
				confidence,
				attribute: response.attributes?.[name],
			}),
		);
		await this.tagRepo.addTagsToMedia(mediaId, tagsToInsert, "AI", tx);

		// 2. IPs — bulk find-or-create
		const ipNames = response.ips;
		const ipNameIdMap = new Map<string, string>();

		if (ipNames.length > 0) {
			const allIps = await this.ipRepo.findOrCreateBulk(ipNames, "AI", tx);
			for (const ip of allIps) {
				ipNameIdMap.set(ip.name, ip.id);
			}
		}

		const ipsToLink: { id: string; confidence?: number }[] = [];
		for (const ipName of ipNames) {
			const ipId = ipNameIdMap.get(ipName);
			if (ipId) {
				ipsToLink.push({ id: ipId });
			}
		}

		if (ipsToLink.length > 0) {
			await this.ipRepo.addMediaBulk(mediaId, ipsToLink, "AI", tx);
		}

		// 3. Characters
		// ips_mapping: { charName: [ipName] }
		const charToIpIdsMap = new Map<string, string[]>();

		for (const [charName, linkedIpNames] of Object.entries(
			response.ips_mapping,
		)) {
			const ipIds: string[] = [];
			for (const linkedIpName of linkedIpNames) {
				const ipId = ipNameIdMap.get(linkedIpName);
				if (ipId) {
					ipIds.push(ipId);
				}
			}
			if (ipIds.length > 0) {
				charToIpIdsMap.set(charName, ipIds);
			}
		}

		// Additive global IP links preserve existing manual character/IP relationships.
		const characters = await this.characterRepo.findOrCreateBulk(
			Object.keys(response.character).map((name) => ({
				name,
				ipIds: charToIpIdsMap.get(name) ?? [],
			})),
			"AI",
			tx,
		);
		await this.characterRepo.addToMediaBulk(
			mediaId,
			characters.map((character) => ({
				id: character.id,
				confidence: response.character[character.name],
			})),
			"AI",
			tx,
		);
	}

	async getCcipFeature(imageBuffer: ArrayBuffer): Promise<CcipFeatureResponse> {
		return await this.aiClient.extractCcipFeature(imageBuffer);
	}

	async getCcipFeatureForMedia(
		mediaSourceId: string,
		mediaId: string,
	): Promise<CcipFeatureResponse> {
		const media = await this.mediaRepo.findById(mediaId);
		if (!media) {
			throw new Error(`Media not found: ${mediaId}`);
		}
		if (media.mediaSourceId !== mediaSourceId) {
			throw new Error("Media not found in source");
		}
		if (media.mediaType !== "image") {
			throw new Error("CCIP feature extraction is only supported for images");
		}
		const mediaSource = await this.sourceRepo.findById(mediaSourceId);
		if (!mediaSource) {
			throw new Error("Media source not found");
		}

		if (mediaSource.type !== "local") {
			throw new Error("Only local media sources is supported.");
		}

		const connectionParse = localConnectionSchema.safeParse(
			mediaSource.connectionInfo,
		);
		if (!connectionParse.success) {
			throw new Error("Invalid local source connection info: missing path");
		}
		const fullPath = path.join(connectionParse.data.path, media.filePath);

		const canUsePathApi = this.isAiServiceLocal();

		if (canUsePathApi) {
			return await this.aiClient.extractCcipFeatureByPath(fullPath);
		}
		const buffer = await this.readFileBuffer(fullPath);
		return await this.aiClient.extractCcipFeature(buffer);
	}

	async getCcipDifference(
		feature1: number[],
		feature2: number[],
	): Promise<number> {
		const result = await this.aiClient.calculateCcipDifference(
			feature1,
			feature2,
		);
		return result.difference;
	}

	async getCcipDistances(
		feature: number[],
		candidates: number[][],
	): Promise<number[]> {
		return await this.aiClient.calculateCcipDistances(feature, candidates);
	}

	/**
	 * Check if AI service is running on localhost
	 * Path-based API only works when AI service can access the file system
	 */
	private isAiServiceLocal(): boolean {
		const baseUrl = this.aiClient.getBaseUrl?.();
		if (!baseUrl) {
			return true; // Fallback: assume local
		}

		try {
			const url = new URL(baseUrl);
			const host = url.hostname.toLowerCase();
			return (
				host === "localhost" ||
				host === "127.0.0.1" ||
				host === "::1" ||
				host === "0.0.0.0"
			);
		} catch {
			return true; // Fallback: assume local if URL parsing fails
		}
	}
}
