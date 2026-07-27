import type {
	CcipEmbeddingKey,
	CcipVectorCandidate,
	CcipVectorMetadata,
	CcipVectorQuery,
	CcipVectorReadQuery,
	CcipVectorRecord,
	ICcipVectorStore,
} from "@solid-imager/application/ports/ccip-vector-store";
import { describe, expect, it } from "vite-plus/test";
import {
	CcipDualWriteError,
	DualWriteCcipVectorStore,
} from "~/infrastructure/ai/dual-write-ccip-vector-store";
import {
	CcipStoreReadOnlyError,
	LanceDbCcipVectorStore,
} from "~/infrastructure/ai/lancedb-ccip-vector-store";

const record: CcipVectorRecord = {
	regionId: null,
	regionKind: "full",
	mediaId: "11111111-1111-4111-8111-111111111111",
	mediaSourceId: "22222222-2222-4222-8222-222222222222",
	vector: [1],
	model: "model",
	embeddingVersion: 1,
	mediaModifiedAt: new Date("2026-07-01T00:00:00.000Z"),
	inputRevision: "revision",
	preprocessingProfile: "profile",
	extractedAt: new Date("2026-07-02T00:00:00.000Z"),
};

class MemoryCcipStore implements ICcipVectorStore {
	readonly records = new Map<string, CcipVectorRecord>();
	upsertCalls = 0;
	failWrites = false;

	async getByRegion(): Promise<CcipVectorRecord | null> {
		return null;
	}

	async get(mediaId: string): Promise<CcipVectorRecord | null> {
		return this.records.get(mediaId) ?? null;
	}

	async getMany(mediaIds: string[]): Promise<Map<string, CcipVectorRecord>> {
		return new Map(
			mediaIds.flatMap((mediaId) => {
				const value = this.records.get(mediaId);
				return value ? [[mediaId, value] as const] : [];
			}),
		);
	}

	async getMetadataMany(): Promise<Map<string, CcipVectorMetadata>> {
		return new Map();
	}

	async upsert(value: CcipVectorRecord): Promise<void> {
		this.upsertCalls += 1;
		if (this.failWrites) throw new Error("simulated backend failure");
		this.records.set(value.mediaId, value);
	}

	async upsertMany(values: CcipVectorRecord[]): Promise<void> {
		for (const value of values) await this.upsert(value);
	}

	async delete(mediaId: string): Promise<void> {
		this.records.delete(mediaId);
	}

	async deleteRegion(): Promise<void> {}
	async deleteEmbedding(_key: CcipEmbeddingKey): Promise<void> {}
	async deleteBySource(): Promise<void> {}
	async listMediaIds(_query?: CcipVectorQuery): Promise<string[]> {
		return [...this.records.keys()];
	}
	async list(_query?: CcipVectorQuery): Promise<CcipVectorRecord[]> {
		return [...this.records.values()];
	}
	async search(
		_vector: number[],
		_limit: number,
		_query: CcipVectorReadQuery,
	): Promise<CcipVectorCandidate[]> {
		return [];
	}
}

describe("DualWriteCcipVectorStore", () => {
	it("reports partial success and permits an idempotent retry", async () => {
		const primary = new MemoryCcipStore();
		const secondary = new MemoryCcipStore();
		secondary.failWrites = true;
		const store = new DualWriteCcipVectorStore(primary, [
			{ name: "primary", store: primary },
			{ name: "secondary", store: secondary },
		]);

		const failure = await store.upsert(record).catch((error: unknown) => error);
		expect(failure).toBeInstanceOf(CcipDualWriteError);
		expect(failure).toMatchObject({
			operation: "upsert",
			succeededBackends: ["primary"],
			failedBackend: "secondary",
		});
		expect(primary.records.size).toBe(1);
		expect(secondary.records.size).toBe(0);

		secondary.failWrites = false;
		await store.upsert(record);
		expect(primary.upsertCalls).toBe(2);
		expect(primary.records.size).toBe(1);
		expect(secondary.records.size).toBe(1);
	});
});

describe("LanceDbCcipVectorStore read-only mode", () => {
	it("rejects mutations with a typed error before opening the database", async () => {
		const store = new LanceDbCcipVectorStore("unused-read-only-test-path", {
			readOnly: true,
		});

		await expect(store.upsert(record)).rejects.toBeInstanceOf(
			CcipStoreReadOnlyError,
		);
	});
});
