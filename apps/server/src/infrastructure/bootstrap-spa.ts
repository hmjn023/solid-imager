import { core } from "@tauri-apps/api";
import { services } from "~/application/registry";
import { UnsupportedDownloadBackend } from "~/infrastructure/downloads/unsupported-download-backend";
import { createImageProcessorFacade } from "~/infrastructure/processing/image-processor-facade";

let isBootstrapped = false;

export function isTauriEnvironment(): boolean {
	return core.isTauri();
}

export async function bootstrapSpa(): Promise<void> {
	if (isBootstrapped) return;
	isBootstrapped = true;

	if (isTauriEnvironment()) {
		const [{ TauriFileSystem }, processingModule] = await Promise.all([
			import("~/infrastructure/file-system/tauri-file-system"),
			import("~/infrastructure/processing/tauri-image-processor"),
		]);
		services.registerFileSystem(new TauriFileSystem());
		services.registerMetadataExtractor(
			new processingModule.TauriMetadataExtractor(),
		);
		services.registerThumbnailGenerator(
			new processingModule.TauriThumbnailGenerator(),
		);
		services.registerMediaProbe(new processingModule.TauriMediaProbe());
		services.registerImageProcessor(
			createImageProcessorFacade({
				metadataExtractor: services.getMetadataExtractor(),
				thumbnailGenerator: services.getThumbnailGenerator(),
				mediaProbe: services.getMediaProbe(),
			}),
		);
		services.registerDownloadBackend(
			new UnsupportedDownloadBackend(
				"Tauri runtime download backend is not wired yet.",
			),
		);
	}
}
