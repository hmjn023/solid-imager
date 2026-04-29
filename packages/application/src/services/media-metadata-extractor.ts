import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	Media,
	MediaGenerationInfo,
} from "@solid-imager/core/domain/media/schemas";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { TagRepository } from "@solid-imager/core/domain/repositories/tag-repository";
import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";

export type MediaMetadataExtractorDeps = {
	mediaRepository: IMediaRepository;
	tagRepository: TagRepository;
	imageProcessor: IImageProcessor;
	pathAdapter: { join(basePath: string, relativePath: string): string };
	logger?: {
		info?(data: unknown, message?: string): void;
		error?(data: unknown, message?: string): void;
	};
};

export async function extractAndPersistMediaMetadata(
	media: Media,
	sourcePath: string,
	deps: MediaMetadataExtractorDeps,
	tx?: Transaction,
): Promise<MediaGenerationInfo | null> {
	const {
		mediaRepository,
		tagRepository,
		imageProcessor,
		pathAdapter,
		logger,
	} = deps;
	const fullPath = pathAdapter.join(sourcePath, media.filePath);

	try {
		const metadata = await imageProcessor.extractMetadata(fullPath);
		logger?.info?.(
			{
				mediaId: media.id,
				fullPath,
				tagsCount: metadata.tags.length,
				hasWorkflow: !!metadata.workflow,
				hasPrompt: !!metadata.prompt,
			},
			"[MediaMetadataExtractor] extractAndPersistMediaMetadata result",
		);
		await mediaRepository.upsertGenerationInfo(
			media.id,
			typeof metadata.prompt === "object"
				? JSON.stringify(metadata.prompt)
				: (metadata.prompt as string | null),
			metadata.workflow as object | null,
			tx,
		);
		if (metadata.tags.length > 0) {
			await tagRepository.addTagsToMedia(
				media.id,
				metadata.tags,
				"comfyui_workflow",
				tx,
			);
		}
		return await mediaRepository.getGenerationInfo(media.id, tx);
	} catch (error) {
		logger?.error?.(
			{ err: error, mediaId: media.id, fullPath },
			"[MediaMetadataExtractor] extractAndPersistMediaMetadata FAILED",
		);
		return null;
	}
}
