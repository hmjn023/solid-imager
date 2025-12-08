import path from "node:path";
import type {
  CCIPFeatureResponse,
  TaggingResponse,
} from "~/domain/tagging/schemas";
import { pythonClient } from "~/infrastructure/ai/python-client";
import { selectMediaSourceById } from "~/infrastructure/db/queries/media-sources";
import { MediaService } from "./media-service";

export class TaggingService {
  async isServiceAvailable(): Promise<boolean> {
    return pythonClient.healthCheck();
  }

  async getTags(imageBuffer: ArrayBuffer): Promise<TaggingResponse> {
    return pythonClient.tagImage(imageBuffer);
  }

  async getTagsForMedia(
    mediaSourceId: string,
    mediaId: string
  ): Promise<TaggingResponse> {
    const media = await MediaService.getMedia(mediaSourceId, mediaId);
    const mediaSource = await selectMediaSourceById(mediaSourceId);

    if (!mediaSource) {
      throw new Error("Media source not found");
    }

    if (mediaSource.type === "local") {
      const connectionInfo = mediaSource.connectionInfo as { path: string };
      const fullPath = path.join(connectionInfo.path, media.filePath);
      return pythonClient.tagImageByPath(fullPath);
    }
    // Fallback for non-local sources (fetch content and send buffer)
    // This might be slow but it works
    const buffer = await MediaService.getMediaContent(mediaSourceId, mediaId);
    return pythonClient.tagImage(buffer.buffer as ArrayBuffer);
  }

  async getCCIPFeature(imageBuffer: ArrayBuffer): Promise<CCIPFeatureResponse> {
    return pythonClient.extractCCIPFeature(imageBuffer);
  }

  async getCCIPFeatureForMedia(
    mediaSourceId: string,
    mediaId: string
  ): Promise<CCIPFeatureResponse> {
    const media = await MediaService.getMedia(mediaSourceId, mediaId);
    const mediaSource = await selectMediaSourceById(mediaSourceId);

    if (!mediaSource) {
      throw new Error("Media source not found");
    }

    if (mediaSource.type === "local") {
      const connectionInfo = mediaSource.connectionInfo as { path: string };
      const fullPath = path.join(connectionInfo.path, media.filePath);
      return pythonClient.extractCCIPFeatureByPath(fullPath);
    }
    const buffer = await MediaService.getMediaContent(mediaSourceId, mediaId);
    return pythonClient.extractCCIPFeature(buffer.buffer as ArrayBuffer);
  }

  async getCCIPDifference(
    feature1: number[],
    feature2: number[]
  ): Promise<number> {
    const result = await pythonClient.calculateCCIPDifference(
      feature1,
      feature2
    );
    return result.difference;
  }
}

export const taggingService = new TaggingService();
