import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import type { IMediaProbe } from "@solid-imager/core/domain/services/media-probe";
import type { IMetadataExtractor } from "@solid-imager/core/domain/services/metadata-extractor";
import type { IThumbnailGenerator } from "@solid-imager/core/domain/services/thumbnail-generator";

export function createImageProcessorFacade(deps: {
	metadataExtractor: IMetadataExtractor;
	thumbnailGenerator: IThumbnailGenerator;
	mediaProbe: IMediaProbe;
}): IImageProcessor {
	return {
		generateThumbnail: (mediaPath, outputPath, size, quality) =>
			deps.thumbnailGenerator.generate(mediaPath, outputPath, size, quality),
		extractMetadata: (mediaPath) => deps.metadataExtractor.extract(mediaPath),
		getDimensions: (mediaPath) => deps.mediaProbe.getDimensions(mediaPath),
	};
}
