import type {
	GenerateThumbnailsResponse,
	ThumbnailSize,
} from "@solid-imager/core/domain/thumbnails/schemas";

/** Provides thumbnail URLs, generation requests and cache clearing for a source. */
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
