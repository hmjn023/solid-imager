import type {
	CcipVectorCandidate,
	CcipEmbeddingKey,
	CcipVectorMetadata,
	CcipVectorQuery,
	CcipVectorReadQuery,
	CcipVectorRecord,
	ICcipVectorStore,
} from "@solid-imager/application/ports/ccip-vector-store";
import type { ILogger } from "@solid-imager/application/ports/media-service";

export type CcipWriteBackend = {
	name: string;
	store: ICcipVectorStore;
};

export class CcipDualWriteError extends Error {
	constructor(
		readonly operation: string,
		readonly succeededBackends: string[],
		readonly failedBackend: string,
		cause: unknown,
	) {
		super(
			`CCIP ${operation} partially failed at ${failedBackend} after ${succeededBackends.join(", ") || "no successful backend"}`,
			{ cause },
		);
		this.name = "CcipDualWriteError";
	}
}

/**
 * Transitional store used only during the rollback observation window. Reads
 * stay on one authoritative backend while every mutation is synchronously
 * applied to both backends; a secondary failure is never hidden.
 */
export class DualWriteCcipVectorStore implements ICcipVectorStore {
	constructor(
		private readonly readStore: ICcipVectorStore,
		private readonly writeBackends: CcipWriteBackend[],
		private readonly logger?: ILogger,
	) {}

	private async write(
		operation: string,
		callback: (store: ICcipVectorStore) => Promise<void>,
	): Promise<void> {
		const succeededBackends: string[] = [];
		for (const backend of this.writeBackends) {
			try {
				await callback(backend.store);
				succeededBackends.push(backend.name);
			} catch (error) {
				this.logger?.error(
					{
						err: error,
						operation,
						failedBackend: backend.name,
						succeededBackends,
					},
					"CCIP dual-write operation failed",
				);
				throw new CcipDualWriteError(
					operation,
					[...succeededBackends],
					backend.name,
					error,
				);
			}
		}
	}

	async get(
		mediaId: string,
		query: CcipVectorReadQuery,
	): Promise<CcipVectorRecord | null> {
		return await this.readStore.get(mediaId, query);
	}

	async getByRegion(
		regionId: string,
		query: CcipVectorReadQuery,
	): Promise<CcipVectorRecord | null> {
		return await this.readStore.getByRegion(regionId, query);
	}

	async getMany(
		mediaIds: string[],
		query: CcipVectorReadQuery,
	): Promise<Map<string, CcipVectorRecord>> {
		return await this.readStore.getMany(mediaIds, query);
	}

	async getMetadataMany(
		mediaIds: string[],
		query: CcipVectorReadQuery,
	): Promise<Map<string, CcipVectorMetadata>> {
		return await this.readStore.getMetadataMany(mediaIds, query);
	}

	async upsert(record: CcipVectorRecord): Promise<void> {
		await this.write("upsert", async (store) => await store.upsert(record));
	}

	async upsertMany(records: CcipVectorRecord[]): Promise<void> {
		await this.write(
			"upsertMany",
			async (store) => await store.upsertMany(records),
		);
	}

	async delete(mediaId: string): Promise<void> {
		await this.write("delete", async (store) => await store.delete(mediaId));
	}

	async deleteRegion(regionId: string): Promise<void> {
		await this.write(
			"deleteRegion",
			async (store) => await store.deleteRegion(regionId),
		);
	}

	async deleteEmbedding(key: CcipEmbeddingKey): Promise<void> {
		await this.write(
			"deleteEmbedding",
			async (store) => await store.deleteEmbedding(key),
		);
	}

	async deleteBySource(mediaSourceId: string): Promise<void> {
		await this.write(
			"deleteBySource",
			async (store) => await store.deleteBySource(mediaSourceId),
		);
	}

	async listMediaIds(query?: CcipVectorQuery): Promise<string[]> {
		return await this.readStore.listMediaIds(query);
	}

	async list(query?: CcipVectorQuery): Promise<CcipVectorRecord[]> {
		return await this.readStore.list(query);
	}

	async search(
		vector: number[],
		limit: number,
		query: CcipVectorReadQuery,
	): Promise<CcipVectorCandidate[]> {
		return await this.readStore.search(vector, limit, query);
	}
}
