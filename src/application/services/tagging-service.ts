import path from "node:path";
import { services } from "~/application/registry";
import type { IAiClient } from "~/domain/interfaces/ai-client";
import type { CharacterRepository } from "~/domain/repositories/character-repository";
import type { IIpRepository } from "~/domain/repositories/ip-repository";
import type { SourceRepository } from "~/domain/repositories/source-repository";
import type { TagRepository as TagRepositoryDef } from "~/domain/repositories/tag-repository";
import { DEFAULT_MANUAL_CONFIDENCE } from "~/domain/tagging/constants";
import type {
  CcipFeatureResponse,
  TaggingResponse,
} from "~/domain/tagging/schemas";
import { MediaService } from "./media-service";

// DI登録は bootstrap.ts で一括管理されるため、ここでは行わない

export class TaggingService {
  private readonly aiClient: IAiClient;
  private readonly sourceRepo: SourceRepository;
  private readonly tagRepo: TagRepositoryDef;
  private readonly characterRepo: CharacterRepository;
  private readonly ipRepo: IIpRepository;

  // biome-ignore lint/nursery/useMaxParams: Dependency injection
  constructor(
    aiClient: IAiClient,
    sourceRepo: SourceRepository,
    tagRepo: TagRepositoryDef,
    characterRepo: CharacterRepository,
    ipRepo: IIpRepository
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

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex logic
  async getTagsForMedia(
    mediaSourceId: string,
    mediaId: string,
    options?: { skipCache?: boolean }
  ): Promise<TaggingResponse> {
    const media = await MediaService.getMedia(mediaSourceId, mediaId);
    if (media.mediaType !== "image") {
      return {
        general: {},
        character: {},
        ips: [],
        // biome-ignore lint/style/useNamingConvention: External API uses snake_case
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
          (i) => i.associationSource === "AI"
        );

        // Reconstruct response
        const response: TaggingResponse = {
          general: {},
          character: {},
          ips: aiIps.map((i) => i.name),
          // biome-ignore lint/style/useNamingConvention: External API uses snake_case
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
          response.ips_mapping[ip.name] = [];
        }

        for (const char of aiCharacters) {
          if (char.ipId && ipMap.has(char.ipId)) {
            const ipName = ipMap.get(char.ipId);
            if (ipName) {
              response.ips_mapping[ipName].push(char.name);
            }
          }
        }

        return response;
      }
    }

    const mediaSource = await this.sourceRepo.findById(mediaSourceId);

    if (!mediaSource) {
      throw new Error("Media source not found");
    }

    let response: TaggingResponse;

    // Check if AI service is accessible locally (can use path-based API)
    // If AI service is on remote host, we must send the file buffer
    const canUsePathApi = this.isAiServiceLocal();

    if (mediaSource.type === "local" && canUsePathApi) {
      const connectionInfo = mediaSource.connectionInfo as { path: string };
      const fullPath = path.join(connectionInfo.path, media.filePath);
      response = await this.aiClient.tagImageByPath(fullPath);
    } else {
      // Send file buffer when:
      // - AI service is remote (can't access local paths)
      // - Media source is not local
      const { buffer } = await MediaService.getMediaContent(
        mediaSourceId,
        mediaId
      );
      response = await this.aiClient.tagImage(buffer.buffer as ArrayBuffer);
    }

    // Save to DB
    await this.saveTags(mediaId, response);

    return response;
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex logic
  private async saveTags(
    mediaId: string,
    response: TaggingResponse
  ): Promise<void> {
    // 1. Tags
    const tagsToInsert = Object.entries(response.general).map(
      ([name, confidence]) => ({
        name,
        type: "positive" as const,
        confidence,
      })
    );
    await this.tagRepo.addTagsToMedia(mediaId, tagsToInsert, "AI");

    // 2. IPs
    const ipNames = response.ips;
    const ipNameIdMap = new Map<string, string>();
    const ipsToLink: { id: string; confidence?: number }[] = [];

    // Process IPs sequentially to handle potential creations (bulk create/find not fully supported by repo yet without refactor)
    // TODO: Refactor IpRepository to support findOrCreateBulk for true bulk performance
    for (const ipName of ipNames) {
      let ip = await this.ipRepo.findByName(ipName);
      if (!ip) {
        try {
          ip = await this.ipRepo.create({ name: ipName, source: "AI" });
        } catch (_e) {
          ip = await this.ipRepo.findByName(ipName);
        }
      }
      if (ip) {
        ipNameIdMap.set(ipName, ip.id);
        ipsToLink.push({ id: ip.id });
      }
    }

    if (ipsToLink.length > 0) {
      await this.ipRepo.addMediaBulk(mediaId, ipsToLink, "AI");
    }

    // 3. Characters
    // ips_mapping: { charName: [ipName] } - Note: The key is character name, value is list of IP names
    const charToIpMap = new Map<string, string>(); // charName -> ipId

    for (const [charName, linkedIpNames] of Object.entries(
      response.ips_mapping
    )) {
      // Find the first linked IP that exists in our DB map
      // (Currently we only support 1 IP per character in the DB schema)
      for (const linkedIpName of linkedIpNames) {
        const ipId = ipNameIdMap.get(linkedIpName);
        if (ipId) {
          charToIpMap.set(charName, ipId);
          break; // Use the first matching IP
        }
      }
    }

    const charsToLink: { id: string; confidence: number }[] = [];

    // Process Characters sequentially for creation/update
    // TODO: Refactor CharacterRepository to support bulk operations
    for (const [charName, confidence] of Object.entries(response.character)) {
      const ipId = charToIpMap.get(charName) ?? undefined;
      let char = await this.characterRepo.findByName(charName);

      if (!char) {
        try {
          char = await this.characterRepo.create({
            name: charName,
            ipId, // Link to IP if known
            source: "AI",
          });
        } catch (_e) {
          char = await this.characterRepo.findByName(charName);
        }
      } else if (!char.ipId && ipId) {
        // Link orphaned character to detected IP
        try {
          await this.characterRepo.update(char.id, { ipId });
        } catch (_e) {
          // Ignore update errors (e.g. race conditions)
        }
      }

      if (char) {
        charsToLink.push({ id: char.id, confidence });
      }
    }

    if (charsToLink.length > 0) {
      await this.characterRepo.addToMediaBulk(mediaId, charsToLink, "AI");
    }
  }

  async getCcipFeature(imageBuffer: ArrayBuffer): Promise<CcipFeatureResponse> {
    return await this.aiClient.extractCcipFeature(imageBuffer);
  }

  async getCcipFeatureForMedia(
    mediaSourceId: string,
    mediaId: string
  ): Promise<CcipFeatureResponse> {
    const media = await MediaService.getMedia(mediaSourceId, mediaId);
    if (media.mediaType !== "image") {
      throw new Error("CCIP feature extraction is only supported for images");
    }
    const mediaSource = await this.sourceRepo.findById(mediaSourceId);

    if (!mediaSource) {
      throw new Error("Media source not found");
    }

    // Check if AI service is accessible locally (can use path-based API)
    const canUsePathApi = this.isAiServiceLocal();

    if (mediaSource.type === "local" && canUsePathApi) {
      const connectionInfo = mediaSource.connectionInfo as { path: string };
      const fullPath = path.join(connectionInfo.path, media.filePath);
      return await this.aiClient.extractCcipFeatureByPath(fullPath);
    }
    const { buffer } = await MediaService.getMediaContent(
      mediaSourceId,
      mediaId
    );
    return await this.aiClient.extractCcipFeature(buffer.buffer as ArrayBuffer);
  }

  async getCcipDifference(
    feature1: number[],
    feature2: number[]
  ): Promise<number> {
    const result = await this.aiClient.calculateCcipDifference(
      feature1,
      feature2
    );
    return result.difference;
  }

  /**
   * Check if AI service is running on localhost
   * Path-based API only works when AI service can access the file system
   */
  private isAiServiceLocal(): boolean {
    const client = this.aiClient as unknown as { getBaseUrl?: () => string };
    const baseUrl = client.getBaseUrl?.();
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

// For backward compatibility and deferred initialization
let _taggingService: TaggingService | null = null;
const getTaggingService = () => {
  if (!_taggingService) {
    _taggingService = new TaggingService(
      services.getAiClient(),
      services.getSourceRepository(),
      services.getTagRepository(),
      services.getCharacterRepository(),
      services.getIpRepository()
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
