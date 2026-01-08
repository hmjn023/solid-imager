import path from "node:path";
import { services } from "~/application/registry";
import type { IAiClient } from "~/domain/interfaces/ai-client";
import type { SourceRepository } from "~/domain/repositories/source-repository";
import type {
  CcipFeatureResponse,
  TaggingResponse,
} from "~/domain/tagging/schemas";
import { MediaService } from "./media-service";

// DI登録は bootstrap.ts で一括管理されるため、ここでは行わない

export class TaggingService {
  private readonly aiClient: IAiClient;
  private readonly sourceRepo: SourceRepository;

  constructor(aiClient: IAiClient, sourceRepo: SourceRepository) {
    this.aiClient = aiClient;
    this.sourceRepo = sourceRepo;
  }

  async isServiceAvailable(): Promise<boolean> {
    return await this.aiClient.healthCheck();
  }

  async getTags(imageBuffer: ArrayBuffer): Promise<TaggingResponse> {
    return await this.aiClient.tagImage(imageBuffer);
  }

  async getTagsForMedia(
    mediaSourceId: string,
    mediaId: string
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
    const mediaSource = await this.sourceRepo.findById(mediaSourceId);

    if (!mediaSource) {
      throw new Error("Media source not found");
    }

    if (mediaSource.type === "local") {
      const connectionInfo = mediaSource.connectionInfo as { path: string };
      const fullPath = path.join(connectionInfo.path, media.filePath);
      return await this.aiClient.tagImageByPath(fullPath);
    }
    // Fallback for non-local sources (fetch content and send buffer)
    // This might be slow but it works
    const { buffer } = await MediaService.getMediaContent(
      mediaSourceId,
      mediaId
    );
    return await this.aiClient.tagImage(buffer.buffer as ArrayBuffer);
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

    if (mediaSource.type === "local") {
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
}

// For backward compatibility and deferred initialization
let _taggingService: TaggingService | null = null;
const getTaggingService = () => {
  if (!_taggingService) {
    _taggingService = new TaggingService(
      services.getAiClient(),
      services.getSourceRepository()
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
