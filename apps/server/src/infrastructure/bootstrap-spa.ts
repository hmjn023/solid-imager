import { core } from "@tauri-apps/api";
import { services } from "~/application/registry";

let isBootstrapped = false;

export function isTauriEnvironment(): boolean {
	return core.isTauri();
}

export async function bootstrapSpa(): Promise<void> {
	if (isBootstrapped) return;
	isBootstrapped = true;

	if (isTauriEnvironment()) {
		const [{ TauriFileSystem }, { TauriImageProcessor }] = await Promise.all([
			import("~/infrastructure/file-system/tauri-file-system"),
			import("~/infrastructure/processing/tauri-image-processor"),
		]);
		services.registerFileSystem(new TauriFileSystem());
		services.registerImageProcessor(new TauriImageProcessor());
	}
}
