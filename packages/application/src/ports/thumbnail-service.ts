import type {
	GenerateThumbnailsResponse,
	ThumbnailSize,
} from "@solid-imager/core/domain/thumbnails/schemas";

export interface IThumbnailService {
	getMediaThumbnailUrl(
		mediaSourceId: string,
		mediaId: string,
		size?: ThumbnailSize,
	): string;

	startThumbnailGeneration(
		mediaSourceId: string,
		options: { size: ThumbnailSize; missingOnly: boolean },
	): Promise<GenerateThumbnailsResponse>;

	clearThumbnailCache(mediaSourceId: string): Promise<{ success: boolean }>;
}
