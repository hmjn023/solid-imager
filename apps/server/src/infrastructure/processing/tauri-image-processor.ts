import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import { invoke } from "@tauri-apps/api/core";

export class TauriImageProcessor implements IImageProcessor {
	async generateThumbnail(
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

	async extractMetadata(mediaPath: string): Promise<{
		tags: { name: string; type: "positive" | "negative" }[];
		prompt: unknown;
		workflow: unknown;
	}> {
		return invoke("extract_metadata", { mediaPath });
	}

	async getDimensions(
		mediaPath: string,
	): Promise<{ width: number; height: number }> {
		return invoke("get_dimensions", { mediaPath });
	}
}
