import path from "node:path";
import type {
  CcipFeatureResponse,
  TaggingResponse,
} from "~/domain/tagging/schemas";
import { pythonClient } from "~/infrastructure/ai/python-client";
// import { selectMediaSourceById } from "~/infrastructure/db/queries/media-sources"; // Removed
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository"; // Added
import { MediaService } from "./media-service";

const sourceRepo = new DrizzleSourceRepository();

export class TaggingService {
  async isServiceAvailable(): Promise<boolean> {
    return await pythonClient.healthCheck();
  }

  async getTags(imageBuffer: ArrayBuffer): Promise<TaggingResponse> {
    return await pythonClient.tagImage(imageBuffer);
  }

  async getTagsForMedia(
    mediaSourceId: string,
    mediaId: string
  ): Promise<TaggingResponse> {
    const media = await MediaService.getMedia(mediaSourceId, mediaId);
    const mediaSource = await sourceRepo.findById(mediaSourceId);

    if (!mediaSource) {
      throw new Error("Media source not found");
    }

    if (mediaSource.type === "local") {
      const connectionInfo = mediaSource.connectionInfo as { path: string };
      const fullPath = path.join(connectionInfo.path, media.filePath);
      return await pythonClient.tagImageByPath(fullPath);
    }
    // Fallback for non-local sources (fetch content and send buffer)
    // This might be slow but it works
    const buffer = await MediaService.getMediaContent(mediaSourceId, mediaId);
    return await pythonClient.tagImage(buffer.buffer as ArrayBuffer);
  }

  async getCcipFeature(imageBuffer: ArrayBuffer): Promise<CcipFeatureResponse> {
    return await pythonClient.extractCcipFeature(imageBuffer);
  }

  async getCcipFeatureForMedia(
    mediaSourceId: string,
    mediaId: string
  ): Promise<CcipFeatureResponse> {
    const media = await MediaService.getMedia(mediaSourceId, mediaId);
    const mediaSource = await sourceRepo.findById(mediaSourceId);

    if (!mediaSource) {
      throw new Error("Media source not found");
    }

    if (mediaSource.type === "local") {
      const connectionInfo = mediaSource.connectionInfo as { path: string };
      const fullPath = path.join(connectionInfo.path, media.filePath);
      return await pythonClient.extractCcipFeatureByPath(fullPath);
    }
    const buffer = await MediaService.getMediaContent(mediaSourceId, mediaId);
    return await pythonClient.extractCcipFeature(buffer.buffer as ArrayBuffer);
  }

  async getCcipDifference(
    feature1: number[],
    feature2: number[]
  ): Promise<number> {
    const result = await pythonClient.calculateCcipDifference(
      feature1,
      feature2
    );
    return result.difference;
  }
}

export const taggingService = new TaggingService();
