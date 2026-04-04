export type RuntimeKind = "web" | "tauri";

export type StorageBackendKind = "rpc" | "local" | "unsupported";
export type DatabaseBackendKind = "pglite" | "postgres" | "unsupported";
export type MediaProcessingBackendKind =
	| "rust"
	| "sharp-ffmpeg"
	| "unsupported";
export type DownloadsBackendKind = "local" | "remote" | "unsupported";
export type AiTaggingBackendKind = "remote" | "unsupported";
export type AppClientBackendKind = "orpc" | "local" | "unsupported";

export type RuntimeCapabilities = {
	runtime: RuntimeKind;
	appClient: AppClientBackendKind;
	storage: StorageBackendKind;
	database: DatabaseBackendKind;
	mediaProcessing: MediaProcessingBackendKind;
	downloads: DownloadsBackendKind;
	aiTagging: AiTaggingBackendKind;
	remoteFallback: "available" | "unavailable";
	supportsRpcBackend: boolean;
	supportsLocalPersistence: boolean;
	supportsLocalMediaProcessing: boolean;
	supportsAiTagging: boolean;
	supportsDownloads: boolean;
	supportsVideoThumbnails: boolean;
	supportsRemoteFallback: boolean;
};

function withDerivedCapabilities(
	config: Omit<
		RuntimeCapabilities,
		| "supportsRpcBackend"
		| "supportsLocalPersistence"
		| "supportsLocalMediaProcessing"
		| "supportsAiTagging"
		| "supportsDownloads"
		| "supportsVideoThumbnails"
		| "supportsRemoteFallback"
	>,
): RuntimeCapabilities {
	return {
		...config,
		supportsRpcBackend: config.appClient === "orpc",
		supportsLocalPersistence: config.storage === "local",
		supportsLocalMediaProcessing: config.mediaProcessing !== "unsupported",
		supportsAiTagging: config.aiTagging !== "unsupported",
		supportsDownloads: config.downloads !== "unsupported",
		supportsVideoThumbnails:
			config.mediaProcessing === "sharp-ffmpeg" ||
			config.mediaProcessing === "rust",
		supportsRemoteFallback: config.remoteFallback === "available",
	};
}

export const webRuntimeCapabilities: RuntimeCapabilities =
	withDerivedCapabilities({
		runtime: "web",
		appClient: "orpc",
		storage: "rpc",
		database: "postgres",
		mediaProcessing: "sharp-ffmpeg",
		downloads: "remote",
		aiTagging: "remote",
		remoteFallback: "unavailable",
	});

export const tauriRuntimeCapabilities: RuntimeCapabilities =
	withDerivedCapabilities({
		runtime: "tauri",
		appClient: "unsupported",
		storage: "unsupported",
		database: "unsupported",
		mediaProcessing: "unsupported",
		downloads: "unsupported",
		aiTagging: "unsupported",
		remoteFallback: "unavailable",
	});

const isTauriBuild = typeof __TAURI_BUILD__ !== "undefined" && __TAURI_BUILD__;

export const runtimeCapabilities = isTauriBuild
	? tauriRuntimeCapabilities
	: webRuntimeCapabilities;
