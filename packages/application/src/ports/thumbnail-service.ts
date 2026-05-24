export interface IThumbnailService {
  getMediaThumbnailUrl(
    mediaSourceId: string,
    mediaId: string,
    size?: number,
  ): string;

  startThumbnailGeneration(
    mediaSourceId: string,
  ): Promise<{ success: boolean; count: number }>;

  clearThumbnailCache(
    mediaSourceId: string,
  ): Promise<{ success: boolean }>;
}
