import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import type { IFileSystem } from "@solid-imager/core/interfaces/file-system";
import {
	createTauriApiClient,
	type TauriApiClient,
} from "./infrastructure/api/tauri-api-client";
import type { TauriDb } from "./infrastructure/db/client";
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
	localDatabaseAvailable: boolean;
};

export type InitializeTauriAppOptions = {
	onStatus?: (message: string) => void;
};

function createUnavailableTauriDb(): TauriDb {
	return new Proxy(
		{},
		{
			get() {
				throw new Error(
					"Tauri local database is disabled during startup because PGlite freezes the Linux WebKit webview.",
				);
			},
		},
	) as TauriDb;
}

export async function initializeTauriApp(
	options: InitializeTauriAppOptions = {},
): Promise<TauriAppServices> {
	if (typeof document === "undefined") {
		throw new Error("initializeTauriApp must be called in the browser.");
	}

	document.documentElement.dataset.platform = "tauri";

	options.onStatus?.("Connecting to the Tauri runtime...");
	const commandClient = createTauriCommandClient();
	const fileSystem = new TauriFileSystem(commandClient);
	const imageProcessor = new TauriImageProcessor(commandClient);
	const apiClient = createTauriApiClient();
	options.onStatus?.("Skipping local database startup...");
	const db = createUnavailableTauriDb();

	return {
		commandClient,
		fileSystem,
		imageProcessor,
		apiClient,
		db,
		localDatabaseAvailable: false,
	};
}
