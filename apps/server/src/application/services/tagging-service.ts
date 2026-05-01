import path from "node:path";
import {
	orchestrateCcipExtraction,
	orchestrateTagging,
} from "@solid-imager/application/services/ai-tagging-service";
import type { IAiClient } from "@solid-imager/core/domain/interfaces/ai-client";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { TagRepository as TagRepositoryDef } from "@solid-imager/core/domain/repositories/tag-repository";
import type {
	CcipFeatureResponse,
	TaggingResponse,
} from "@solid-imager/core/domain/tagging/schemas";
import { services } from "~/application/registry";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { MediaService } from "./media-service";

// DI登録は bootstrap.ts で一括管理されるため、ここでは行わない

export class TaggingService {
	private readonly aiClient: IAiClient;
	private readonly sourceRepo: SourceRepository;
	private readonly tagRepo: TagRepositoryDef;
	private readonly characterRepo: CharacterRepository;
	private readonly ipRepo: IIpRepository;

	constructor(
		aiClient: IAiClient,
		sourceRepo: SourceRepository,
		tagRepo: TagRepositoryDef,
		characterRepo: CharacterRepository,
		ipRepo: IIpRepository,
	) {
		this.aiClient = aiClient;
		this.sourceRepo = sourceRepo;
		this.tagRepo = tagRepo;
		this.characterRepo = characterRepo;
		this.ipRepo = ipRepo;
	}

	async isServiceAvailable(): Promise<boolean> {
		return await this.aiClient.healthCheck();
	}

	async getTags(imageBuffer: ArrayBuffer): Promise<TaggingResponse> {
		return await this.aiClient.tagImage(imageBuffer);
	}

	private getAiBaseUrl(): string | undefined {
		const client = this.aiClient as unknown as {
			getBaseUrl?: () => string;
		};
		return client.getBaseUrl?.();
	}

	async getTagsForMedia(
		mediaSourceId: string,
		mediaId: string,
		options?: { skipCache?: boolean },
	): Promise<TaggingResponse> {
		const media = await MediaService.getMedia(mediaSourceId, mediaId);
		if (media.mediaType !== "image") {
			return {
				general: {},
				character: {},
				ips: [],
				ips_mapping: {},
			};
		}

		const mediaSource = await this.sourceRepo.findById(mediaSourceId);
		if (!mediaSource) {
			throw new Error("Media source not found");
		}

		return await orchestrateTagging(mediaId, options, {
			aiClient: this.aiClient,
			reconstructDeps: {
				tagRepository: this.tagRepo,
				characterRepository: this.characterRepo,
				ipRepository: this.ipRepo,
			},
			getAiBaseUrl: () => this.getAiBaseUrl(),
			mediaSourceType: mediaSource.type,
			mediaSourceConnectionInfo: mediaSource.connectionInfo,
			mediaFilePath: media.filePath,
			getBuffer: async () => {
				const { buffer } = await MediaService.getMediaContent(
					mediaSourceId,
					mediaId,
				);
				return buffer.buffer as ArrayBuffer;
			},
			joinPath: path.join,
			persistResponse: async (response) => {
				const { persistTaggingResponse } = await import(
					"@solid-imager/application/services/tag-persistence"
				);
				await persistTaggingResponse(mediaId, response, {
					tagRepository: this.tagRepo,
					ipRepository: this.ipRepo,
					characterRepository: this.characterRepo,
					source: "AI",
				});

				// Notify clients of the update
				SseManager.sendEvent(mediaSourceId, "media-changed", {
					filePath: media.filePath,
					mediaId,
					timestamp: new Date().toISOString(),
				});
			},
		});
	}

	async getCcipFeature(imageBuffer: ArrayBuffer): Promise<CcipFeatureResponse> {
		return await this.aiClient.extractCcipFeature(imageBuffer);
	}

	async getCcipFeatureForMedia(
		mediaSourceId: string,
		mediaId: string,
	): Promise<CcipFeatureResponse> {
		const media = await MediaService.getMedia(mediaSourceId, mediaId);
		if (media.mediaType !== "image") {
			throw new Error("CCIP feature extraction is only supported for images");
		}
		const mediaSource = await this.sourceRepo.findById(mediaSourceId);
		if (!mediaSource) {
			throw new Error("Media source not found");
		}

		return await orchestrateCcipExtraction({
			aiClient: this.aiClient,
			getAiBaseUrl: () => this.getAiBaseUrl(),
			mediaSourceType: mediaSource.type,
			mediaSourceConnectionInfo: mediaSource.connectionInfo,
			mediaFilePath: media.filePath,
			getBuffer: async () => {
				const { buffer } = await MediaService.getMediaContent(
					mediaSourceId,
					mediaId,
				);
				return buffer.buffer as ArrayBuffer;
			},
			joinPath: path.join,
		});
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
}

// For backward compatibility and deferred initialization
let _taggingService: TaggingService | null = null;
const getTaggingService = () => {
	if (!_taggingService) {
		_taggingService = new TaggingService(
			services.getAiClient(),
			services.getSourceRepository(),
			services.getTagRepository(),
			services.getCharacterRepository(),
			services.getIpRepository(),
		);
	}
	return _taggingService;
};

export const taggingService = new Proxy({} as TaggingService, {
	get(_target, prop) {
		const service = getTaggingService();
		const value = service[prop as keyof TaggingService];
		return typeof value === "function" ? value.bind(service) : value;
	},
});
