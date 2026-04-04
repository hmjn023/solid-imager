export type RuntimeKind = "web" | "tauri";

export type RuntimeCapabilities = {
	runtime: RuntimeKind;
	supportsRpcBackend: boolean;
	supportsLocalPersistence: boolean;
	supportsLocalMediaProcessing: boolean;
	supportsAiTagging: boolean;
	supportsDownloads: boolean;
	supportsVideoThumbnails: boolean;
	supportsRemoteFallback: boolean;
};

export const webRuntimeCapabilities: RuntimeCapabilities = {
	runtime: "web",
	supportsRpcBackend: true,
	supportsLocalPersistence: false,
	supportsLocalMediaProcessing: false,
	supportsAiTagging: true,
	supportsDownloads: true,
	supportsVideoThumbnails: true,
	supportsRemoteFallback: false,
};

export const tauriRuntimeCapabilities: RuntimeCapabilities = {
	runtime: "tauri",
	supportsRpcBackend: false,
	supportsLocalPersistence: false,
	supportsLocalMediaProcessing: false,
	supportsAiTagging: false,
	supportsDownloads: false,
	supportsVideoThumbnails: false,
	supportsRemoteFallback: false,
};

export const runtimeCapabilities = __TAURI_BUILD__
	? tauriRuntimeCapabilities
	: webRuntimeCapabilities;
