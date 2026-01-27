import path from "node:path";
import { services } from "~/application/registry";
import type { IAiClient } from "~/domain/interfaces/ai-client";
import type { SourceRepository } from "~/domain/repositories/source-repository";
import type {
  CcipFeatureResponse,
  TaggingResponse,
} from "~/domain/tagging/schemas";
import type { PythonClient } from "~/infrastructure/ai/python-client";
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

    // Check if AI service is accessible locally (can use path-based API)
    // If AI service is on remote host, we must send the file buffer
    const canUsePathApi = this.isAiServiceLocal();

    if (mediaSource.type === "local" && canUsePathApi) {
      const connectionInfo = mediaSource.connectionInfo as { path: string };
      const fullPath = path.join(connectionInfo.path, media.filePath);
      return await this.aiClient.tagImageByPath(fullPath);
    }
    // Send file buffer when:
    // - AI service is remote (can't access local paths)
    // - Media source is not local
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
    const baseUrl = (this.aiClient as PythonClient).getBaseUrl?.();
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
