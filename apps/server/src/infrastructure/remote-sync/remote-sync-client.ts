/**
 * Remote Sync Client
 * Handles communication with remote servers for media synchronization
 */

import type {
	ConflictResolutionRequest,
	ConflictResolutionResponse,
	MediaListRequest,
	MediaListResponse,
	MediaMetadataRequest,
	MediaMetadataResponse,
	PullMediaRequest,
	PullMediaResponse,
	PushMediaRequest,
	PushMediaResponse,
	SyncRequest,
	SyncResponse,
} from "@solid-imager/core/domain/media/sync-schemas";

/**
 * Remote Sync Client Implementation
 * Uses fetch API to communicate with remote servers
 */
export class RemoteSyncClient {
	private baseUrl: string;

	constructor() {
		// These will be configured per remote source
		this.baseUrl = "";
	}

	/**
	 * Initialize client with remote source connection info
	 */
	initialize(url: string, _remoteSourceId: string): void {
		this.baseUrl = url;
		// remoteSourceId will be used for future authentication/authorization
	}

	/**
	 * Ensure the client is initialized before making requests
	 */
	private ensureInitialized(): void {
		if (!this.baseUrl) {
			throw new Error(
				"RemoteSyncClient not initialized. Call initialize() first.",
			);
		}
	}

	/**
	 * Get media list from remote server
	 */
	async getMediaList(request: MediaListRequest): Promise<MediaListResponse> {
		this.ensureInitialized();
		const url = new URL("/api/sync/media-list", this.baseUrl);
		url.searchParams.set("sourceId", request.sourceId);
		if (request.cursor) {
			url.searchParams.set("cursor", request.cursor);
		}
		url.searchParams.set("limit", request.limit.toString());

		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to get media list: ${error}`);
		}

		return response.json();
	}

	/**
	 * Get media metadata from remote server
	 */
	async getMediaMetadata(
		request: MediaMetadataRequest,
	): Promise<MediaMetadataResponse> {
		this.ensureInitialized();
		const url = new URL(
			`/api/sync/media-metadata/${request.mediaId}`,
			this.baseUrl,
		);

		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to get media metadata: ${error}`);
		}

		return response.json();
	}

	/**
	 * Push media to remote server
	 */
	async pushMedia(request: PushMediaRequest): Promise<PushMediaResponse> {
		this.ensureInitialized();
		const url = new URL("/api/sync/push", this.baseUrl);

		const response = await fetch(url.toString(), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(request),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to push media: ${error}`);
		}

		return response.json();
	}

	/**
	 * Pull media from remote server
	 */
	async pullMedia(request: PullMediaRequest): Promise<PullMediaResponse> {
		this.ensureInitialized();
		const url = new URL("/api/sync/pull", this.baseUrl);

		const response = await fetch(url.toString(), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(request),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to pull media: ${error}`);
		}

		return response.json();
	}

	/**
	 * Execute bidirectional sync
	 */
	async sync(request: SyncRequest): Promise<SyncResponse> {
		this.ensureInitialized();
		const url = new URL("/api/sync/execute", this.baseUrl);

		const response = await fetch(url.toString(), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(request),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to execute sync: ${error}`);
		}

		return response.json();
	}

	/**
	 * Resolve sync conflict
	 */
	async resolveConflict(
		request: ConflictResolutionRequest,
	): Promise<ConflictResolutionResponse> {
		this.ensureInitialized();
		const url = new URL("/api/sync/resolve-conflict", this.baseUrl);

		const response = await fetch(url.toString(), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(request),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to resolve conflict: ${error}`);
		}

		return response.json();
	}

	/**
	 * Get sync status for a media item
	 */
	async getSyncStatus(mediaId: string) {
		const url = new URL(`/api/sync/status/${mediaId}`, this.baseUrl);

		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to get sync status: ${error}`);
		}

		return response.json();
	}

	/**
	 * Get sync status for all media in a source
	 */
	async getSourceSyncStatus(sourceId: string) {
		const url = new URL(`/api/sync/source-status/${sourceId}`, this.baseUrl);

		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to get source sync status: ${error}`);
		}

		return response.json();
	}
}
