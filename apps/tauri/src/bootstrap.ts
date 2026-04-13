import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import type { IFileSystem } from "@solid-imager/core/interfaces/file-system";
import {
	createTauriApiClient,
	type TauriApiClient,
} from "./infrastructure/api/tauri-api-client";
import {
	initializeTauriDb,
	type TauriDb,
} from "./infrastructure/db/client";
import {
	createTauriCommandClient,
	type TauriCommandClient,
} from "./infrastructure/tauri/command-client";
import { TauriFileSystem } from "./infrastructure/tauri/file-system";
import { TauriImageProcessor } from "./infrastructure/tauri/image-processor";

export type TauriAppServices = {
	commandClient: TauriCommandClient;
	fileSystem: IFileSystem;
	imageProcessor: IImageProcessor;
	apiClient: TauriApiClient;
	db: TauriDb;
};

export async function initializeTauriApp(): Promise<TauriAppServices> {
	if (typeof document === "undefined") {
		throw new Error("initializeTauriApp must be called in the browser.");
	}

	document.documentElement.dataset.platform = "tauri";

	const commandClient = createTauriCommandClient();
	const fileSystem = new TauriFileSystem(commandClient);
	const imageProcessor = new TauriImageProcessor(commandClient);
	const apiClient = createTauriApiClient(commandClient);
	const db = await initializeTauriDb();

	return {
		commandClient,
		fileSystem,
		imageProcessor,
		apiClient,
		db,
	};
}
