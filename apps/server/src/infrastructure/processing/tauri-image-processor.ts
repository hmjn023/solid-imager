import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import type {
	IMediaProbe,
	MediaProbeResult,
} from "@solid-imager/core/domain/services/media-probe";
import type {
	ExtractedMediaMetadata,
	IMetadataExtractor,
} from "@solid-imager/core/domain/services/metadata-extractor";
import type { IThumbnailGenerator } from "@solid-imager/core/domain/services/thumbnail-generator";
import { invoke } from "@tauri-apps/api/core";
import { createImageProcessorFacade } from "./image-processor-facade";

export class TauriThumbnailGenerator implements IThumbnailGenerator {
	async generate(
		mediaPath: string,
		outputPath: string,
		size: number,
		quality: number,
	): Promise<void> {
		await invoke("generate_thumbnail", {
			mediaPath,
			outputPath,
			size,
			quality,
		});
	}
}

export class TauriMetadataExtractor implements IMetadataExtractor {
	async extract(mediaPath: string): Promise<ExtractedMediaMetadata> {
		return invoke("extract_metadata", { mediaPath });
	}
}

export class TauriMediaProbe implements IMediaProbe {
	async getDimensions(
		mediaPath: string,
	): Promise<{ width: number; height: number }> {
		return invoke("get_dimensions", { mediaPath });
	}

	async probe(mediaPath: string) {
		return invoke("probe_media", { mediaPath }) as Promise<MediaProbeResult>;
	}
}

export class TauriImageProcessor implements IImageProcessor {
	private readonly facade: IImageProcessor;

	constructor() {
		this.facade = createImageProcessorFacade({
			metadataExtractor: new TauriMetadataExtractor(),
			thumbnailGenerator: new TauriThumbnailGenerator(),
			mediaProbe: new TauriMediaProbe(),
		});
	}

	generateThumbnail(
		mediaPath: string,
		outputPath: string,
		size: number,
		quality: number,
	): Promise<void> {
		return this.facade.generateThumbnail(mediaPath, outputPath, size, quality);
	}

	extractMetadata(mediaPath: string): Promise<ExtractedMediaMetadata> {
		return this.facade.extractMetadata(mediaPath);
	}

	getDimensions(mediaPath: string): Promise<{ width: number; height: number }> {
		return this.facade.getDimensions(mediaPath);
	}
}
