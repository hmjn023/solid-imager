import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type {
	ConflictResolutionRequest,
	ConflictResolutionResponse,
	GetSourceSyncStatusResponse,
	GetSyncStatusResponse,
	MediaListRequest,
	MediaListResponse,
	MediaMetadataRequest,
	MediaMetadataResponse,
	SyncRequest,
	SyncResponse,
} from "@solid-imager/core/domain/media/sync-schemas";
import type { AppRouter } from "~/domain/shared/api-contract";

/**
 * Thin oRPC client for remote sync endpoints.
 */
export class RemoteSyncClient {
	private remoteClient: RouterClient<AppRouter> | null = null;

	initialize(url: string): void {
		const rpcUrl = new URL("/api/rpc", url).toString();
		const link = new RPCLink({
			url: rpcUrl,
			fetch,
		});
		this.remoteClient = createORPCClient(link) as RouterClient<AppRouter>;
	}

	private getClient(): RouterClient<AppRouter> {
		if (!this.remoteClient) {
			throw new Error(
				"RemoteSyncClient not initialized. Call initialize() first.",
			);
		}
		return this.remoteClient;
	}

	async getMediaList(request: MediaListRequest): Promise<MediaListResponse> {
		return await this.getClient().sync.getMediaList(request);
	}

	async getMediaMetadata(
		request: MediaMetadataRequest,
	): Promise<MediaMetadataResponse> {
		return await this.getClient().sync.getMediaMetadata(request);
	}

	async sync(request: SyncRequest): Promise<SyncResponse> {
		return await this.getClient().sync.sync(request);
	}

	async resolveConflict(
		request: ConflictResolutionRequest,
	): Promise<ConflictResolutionResponse> {
		return await this.getClient().sync.resolveConflict(request);
	}

	async getSyncStatus(
		mediaId: string,
		remoteSourceId: string,
	): Promise<GetSyncStatusResponse> {
		return await this.getClient().sync.getSyncStatus({
			mediaId,
			remoteSourceId,
		});
	}

	async getSourceSyncStatus(
		sourceId: string,
		remoteSourceId: string,
	): Promise<GetSourceSyncStatusResponse> {
		return await this.getClient().sync.getSourceSyncStatus({
			sourceId,
			remoteSourceId,
		});
	}
}
