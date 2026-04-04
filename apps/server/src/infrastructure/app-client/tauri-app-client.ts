import type { RouterClient } from "@orpc/server";
import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { defaultAppConfig } from "@solid-imager/core/domain/config/config-schema";
import type { MediaSearchResponse } from "@solid-imager/core/domain/media/schemas";
import type {
	GetSourceSyncStatusResponse,
	GetSyncStatusResponse,
	MediaListResponse,
	MediaMetadataResponse,
	SyncResponse,
} from "@solid-imager/core/domain/media/sync-schemas";
import type { TaggingResponse } from "@solid-imager/core/domain/tagging/schemas";
import type { AppRouter } from "~/domain/shared/api-contract";
import { UnsupportedRuntimeError } from "./errors";

const TAURI_RUNTIME_MESSAGE =
	"Tauri runtime is not wired to a local backend yet. This feature is unavailable in the current desktop build.";

function unsupported(): never {
	throw new UnsupportedRuntimeError(TAURI_RUNTIME_MESSAGE);
}

async function emptyStream() {
	return (async function* () {
		yield* [];
	})();
}

const emptyMediaSearchResponse: MediaSearchResponse = {
	media: [],
	total: 0,
};

const emptyTaggingResponse: TaggingResponse = {
	general: {},
	character: {},
	ips: [],
	ips_mapping: {},
};

const emptySyncResponse: SyncResponse = {
	success: false,
	stats: {
		totalMedia: 0,
		pushed: 0,
		pulled: 0,
		conflicts: 0,
		errors: 0,
	},
	conflicts: [],
	errors: [],
};

const emptySourceSyncStatus: GetSourceSyncStatusResponse = {
	totalMedia: 0,
	synced: 0,
	pending: 0,
	failed: 0,
	conflicts: [],
};

const emptySyncStatus: GetSyncStatusResponse = {
	mediaId: "00000000-0000-4000-8000-000000000000",
	status: "not_found",
};

const emptyMediaListResponse: MediaListResponse = {
	media: [],
	total: 0,
	hasMore: false,
};

const tauriConfigClient = {
	get: async (): Promise<AppConfig> => defaultAppConfig,
	update: async () => unsupported(),
};

const tauriSourcesClient = {
	list: async () => [],
	get: async () => null,
	create: async () => unsupported(),
	update: async () => unsupported(),
	delete: async () => unsupported(),
	sync: async () => unsupported(),
	restore: async () => unsupported(),
	events: async () => emptyStream(),
};

const tauriSyncClient = {
	getSourceSyncStatus: async (): Promise<GetSourceSyncStatusResponse> =>
		emptySourceSyncStatus,
	sync: async (): Promise<SyncResponse> => emptySyncResponse,
	resolveConflict: async () => unsupported(),
	getMediaList: async (): Promise<MediaListResponse> => emptyMediaListResponse,
	getMediaMetadata: async (): Promise<MediaMetadataResponse> => unsupported(),
	getSyncStatus: async (): Promise<GetSyncStatusResponse> => emptySyncStatus,
};

const tauriMediaClient = {
	search: async (): Promise<MediaSearchResponse> => emptyMediaSearchResponse,
	getDetails: async () => unsupported(),
	upload: async () => unsupported(),
	update: async () => unsupported(),
	delete: async () => unsupported(),
	copy: async () => unsupported(),
	move: async () => unsupported(),
	sync: async () => unsupported(),
};

const tauriAiClient = {
	tag: async (): Promise<TaggingResponse> => emptyTaggingResponse,
	startBatchTaggingWithIds: async () => unsupported(),
	scanBatchTaggingTargets: async () => unsupported(),
};

const tauriImportsClient = {
	listPending: async () => [],
	process: async () => unsupported(),
	cancel: async () => unsupported(),
	events: async () => emptyStream(),
};

const tauriThumbnailsClient = {
	generate: async () => unsupported(),
	clear: async () => unsupported(),
};

const tauriPresetsClient = {
	list: async () => [],
	get: async () => null,
	getByName: async () => null,
	create: async () => unsupported(),
	update: async () => unsupported(),
	delete: async () => unsupported(),
};

const tauriCrudCollectionClient = {
	list: async () => [],
	get: async () => null,
	create: async () => unsupported(),
	update: async () => unsupported(),
	delete: async () => unsupported(),
};

const tauriAssociationClient = {
	listForMedia: async () => [],
	addToMedia: async () => unsupported(),
	removeFromMedia: async () => unsupported(),
};

export const tauriAppClient = {
	config: tauriConfigClient,
	sources: tauriSourcesClient,
	sync: tauriSyncClient,
	media: tauriMediaClient,
	ai: tauriAiClient,
	imports: tauriImportsClient,
	thumbnails: tauriThumbnailsClient,
	downloads: { start: async () => unsupported() },
	utils: { fetchUrl: async () => unsupported() },
	authors: { list: async () => [] },
	presets: tauriPresetsClient,
	categories: tauriCrudCollectionClient,
	tags: tauriCrudCollectionClient,
	characters: {
		...tauriCrudCollectionClient,
		...tauriAssociationClient,
	},
	ips: {
		...tauriCrudCollectionClient,
		...tauriAssociationClient,
	},
	projects: {
		...tauriCrudCollectionClient,
		...tauriAssociationClient,
	},
	directories: {
		list: async () => [],
		create: async () => unsupported(),
		update: async () => unsupported(),
		delete: async () => unsupported(),
	},
} as unknown as RouterClient<AppRouter>;
