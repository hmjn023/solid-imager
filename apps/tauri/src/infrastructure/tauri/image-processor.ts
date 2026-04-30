import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import type { TauriCommandClient } from "./command-client";

type ExtractedMetadata = Awaited<ReturnType<IImageProcessor["extractMetadata"]>>;
type MediaDimensions = Awaited<ReturnType<IImageProcessor["getDimensions"]>>;

export class TauriImageProcessor implements IImageProcessor {
	constructor(private readonly commandClient: TauriCommandClient) {}

	async generateThumbnail(mediaPath: string, outputPath: string, size: number, quality: number) {
		await this.commandClient.invoke("image_generate_thumbnail", {
			mediaPath,
			outputPath,
			size,
			quality,
		});
	}

	async extractMetadata(mediaPath: string): Promise<ExtractedMetadata> {
		return this.commandClient.invoke<ExtractedMetadata>("image_extract_metadata", {
			mediaPath,
		});
	}

	async getDimensions(mediaPath: string): Promise<MediaDimensions> {
		return this.commandClient.invoke<MediaDimensions>("image_get_dimensions", {
			mediaPath,
		});
	}
}
