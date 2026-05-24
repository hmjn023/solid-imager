import type {
  CcipFeatureResponse,
  TaggingResponse,
} from "@solid-imager/core/domain/tagging/schemas";

export interface ITaggingService {
  isServiceAvailable(): Promise<boolean>;
  getTags(imageBuffer: ArrayBuffer): Promise<TaggingResponse>;
  getTagsForMedia(
    mediaSourceId: string,
    mediaId: string,
    options?: { skipCache?: boolean },
  ): Promise<TaggingResponse>;
  getCcipFeature(imageBuffer: ArrayBuffer): Promise<CcipFeatureResponse>;
  getCcipFeatureForMedia(
    mediaSourceId: string,
    mediaId: string,
  ): Promise<CcipFeatureResponse>;
  getCcipDifference(feature1: number[], feature2: number[]): Promise<number>;
}
