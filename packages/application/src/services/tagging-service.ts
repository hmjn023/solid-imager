import path from "node:path";
import type { IAiClient } from "@solid-imager/core/domain/interfaces/ai-client";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { TagRepository as TagRepositoryDef } from "@solid-imager/core/domain/repositories/tag-repository";
import type { SourceEventPublisher } from "@solid-imager/core/domain/sources/events";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import { DEFAULT_MANUAL_CONFIDENCE } from "@solid-imager/core/domain/tagging/constants";
import type {
	CcipFeatureResponse,
	TaggingResponse,
} from "@solid-imager/core/domain/tagging/schemas";
import type { ILogger } from "../ports/media-service";
import type { ITaggingService } from "../ports/tagging-service";

export type TaggingServiceDeps = {
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
		options?: { skipCache?: boolean },
	): Promise<TaggingResponse | null> {
		const media = await this.mediaRepo.findById(mediaId);
		if (!media) {
			throw new Error(`Media not found: ${mediaId}`);
		}
		if (media.mediaSourceId !== mediaSourceId) {
			throw new Error("Media not found in source");
		}
		if (media.mediaType !== "image") {
			return {
				general: {},
				character: {},
				ips: [],
				ips_mapping: {},
			};
		}

		// 1. Check Cache (DB)
		if (!options?.skipCache) {
			const existingTags = await this.tagRepo.findByMediaId(mediaId);
			const aiTags = existingTags.filter((t) => t.source === "AI");

			if (aiTags.length > 0) {
				const aiCharacters = (
					await this.characterRepo.getMediaCharacters(mediaId)
				).filter((c) => c.associationSource === "AI");
				const aiIps = (await this.ipRepo.getMediaIps(mediaId)).filter(
					(i) => i.associationSource === "AI",
				);

				// Reconstruct response
				const response: TaggingResponse = {
					general: {},
					character: {},
					ips: aiIps.map((i) => i.name),
					ips_mapping: {},
				};

				for (const tag of aiTags) {
					response.general[tag.name] =
						tag.confidence ?? DEFAULT_MANUAL_CONFIDENCE;
				}
				for (const char of aiCharacters) {
					response.character[char.name] =
						char.confidence ?? DEFAULT_MANUAL_CONFIDENCE;
				}

				// ips_mapping: We need to know which IP a character belongs to.
				const ipMap = new Map<string, string>(); // id -> name
				for (const ip of aiIps) {
					ipMap.set(ip.id, ip.name);
				}

				for (const char of aiCharacters) {
					const matchedIpNames: string[] = [];
					for (const charIp of char.ips) {
						if (ipMap.has(charIp.id)) {
							const ipName = ipMap.get(charIp.id);
							if (ipName) {
								matchedIpNames.push(ipName);
							}
						}
					}
					if (matchedIpNames.length > 0) {
						response.ips_mapping[char.name] = matchedIpNames;
					}
				}

				return response;
			}
		}

		const mediaSource = await this.sourceRepo.findById(mediaSourceId);

		if (!mediaSource) {
			throw new Error("Media source not found");
		}

		if (mediaSource.type !== "local") {
			this.logger?.error(
				{ mediaSourceId, type: mediaSource.type },
				"Only local media sources are supported for AI tagging.",
			);
			return null;
		}

		const connectionParse = localConnectionSchema.safeParse(
			mediaSource.connectionInfo,
		);
		if (!connectionParse.success) {
			throw new Error("Invalid local source connection info: missing path");
		}
		const fullPath = path.join(connectionParse.data.path, media.filePath);

		let response: TaggingResponse;
		const canUsePathApi = this.isAiServiceLocal();

		if (canUsePathApi) {
			response = await this.aiClient.tagImageByPath(fullPath);
		} else {
			const buffer = await this.readFileBuffer(fullPath);
			response = await this.aiClient.tagImage(buffer);
		}

		// Save to DB
		await this.saveTags(mediaSourceId, mediaId, media.filePath, response);

		return response;
	}

	private async saveTags(
		mediaSourceId: string,
		mediaId: string,
		filePath: string,
		response: TaggingResponse,
	): Promise<void> {
		// 1. Tags
		const tagsToInsert = Object.entries(response.general).map(
			([name, confidence]) => ({
				name,
				type: "positive" as const,
				confidence,
			}),
		);
		await this.tagRepo.addTagsToMedia(mediaId, tagsToInsert, "AI");

		// 2. IPs — bulk find-or-create
		const ipNames = response.ips;
		const ipNameIdMap = new Map<string, string>();

		if (ipNames.length > 0) {
			const allIps = await this.ipRepo.findOrCreateBulk(ipNames, "AI");
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
			await this.ipRepo.addMediaBulk(mediaId, ipsToLink, "AI");
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

		const charNames = Object.keys(response.character);

		// Fetch existing characters in one query
		const existingChars = await this.characterRepo.findByNames(charNames);
		const existingCharMap = new Map(existingChars.map((c) => [c.name, c]));

		// Build full character data for findOrCreateBulk:
		// For existing chars, merge existing IPs with newly detected IPs
		const bulkCharData: Array<{ name: string; ipIds: string[] }> = [];
		const charsNeedingUpdate: Array<{
			id: string;
			ipIds: string[];
		}> = [];

		for (const charName of charNames) {
			const newIpIds: string[] = charToIpIdsMap.get(charName) ?? [];
			const existing = existingCharMap.get(charName);

			if (!existing) {
				// New character — will be created by findOrCreateBulk
				bulkCharData.push({ name: charName, ipIds: newIpIds });
			} else if (existing.ips.length === 0 && newIpIds.length > 0) {
				// Existing character with no IPs — need to link IPs
				charsNeedingUpdate.push({ id: existing.id, ipIds: newIpIds });
			} else if (newIpIds.length > 0) {
				// Existing character with some IPs — append only new ones
				const existingIpIds = new Set(existing.ips.map((i) => i.id));
				const appendedIds: string[] = newIpIds.filter(
					(id) => !existingIpIds.has(id),
				);
				if (appendedIds.length > 0) {
					charsNeedingUpdate.push({
						id: existing.id,
						ipIds: [...existingIpIds, ...appendedIds],
					});
				}
			}
		}

		// Bulk create new characters with IP links
		const newChars = await this.characterRepo.findOrCreateBulk(
			bulkCharData,
			"AI",
		);

		// Bulk IP updates for existing characters
		if (charsNeedingUpdate.length > 0) {
			await this.characterRepo.updateIpsBulk(charsNeedingUpdate, "AI");
		}

		// Build character link list for addToMediaBulk
		const charsToLink: { id: string; confidence: number }[] = [];

		for (const char of existingChars) {
			const confidence = response.character[char.name];
			charsToLink.push({ id: char.id, confidence });
		}
		for (const char of newChars) {
			const confidence = response.character[char.name];
			if (confidence !== undefined) {
				charsToLink.push({ id: char.id, confidence });
			}
		}

		if (charsToLink.length > 0) {
			await this.characterRepo.addToMediaBulk(mediaId, charsToLink, "AI");
		}

		// Notify clients of the update
		this.publishSourceEvent(mediaSourceId, "media-changed", {
			filePath,
			mediaId,
			timestamp: new Date().toISOString(),
		});
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
