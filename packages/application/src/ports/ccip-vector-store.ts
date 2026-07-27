export type CcipVectorRecord = {
	regionId: string | null;
	regionKind: "full" | "person" | "manual";
	mediaId: string;
	mediaSourceId: string;
	vector: number[];
	model: string;
	embeddingVersion: number;
	mediaModifiedAt: Date;
	inputRevision: string;
	preprocessingProfile: string;
	extractedAt: Date;
};

export type CcipVectorQuery = {
	regionId?: string;
	regionKind?: "full" | "person" | "manual";
	mediaSourceId?: string;
	model?: string;
	embeddingVersion?: number;
	preprocessingProfile?: string;
};

/** Query used by reads that must not mix embedding spaces. */
export type CcipVectorReadQuery = {
	regionId?: string;
	regionKind?: "full" | "person" | "manual";
	mediaSourceId?: string;
	model: string;
	embeddingVersion: number;
	preprocessingProfile: string;
};

export type CcipVectorMetadata = Omit<CcipVectorRecord, "vector">;

export type CcipVectorCandidate = CcipVectorRecord & {
	cosineDistance: number;
};

export type CcipEmbeddingKey = {
	regionId: string;
	model: string;
	embeddingVersion: number;
	preprocessingProfile: string;
};

export interface ICcipVectorStore {
	getByRegion(
		regionId: string,
		query: CcipVectorReadQuery,
	): Promise<CcipVectorRecord | null>;
	get(
		mediaId: string,
		query: CcipVectorReadQuery,
	): Promise<CcipVectorRecord | null>;
	getMany(
		mediaIds: string[],
		query: CcipVectorReadQuery,
	): Promise<Map<string, CcipVectorRecord>>;
	getMetadataMany(
		mediaIds: string[],
		query: CcipVectorReadQuery,
	): Promise<Map<string, CcipVectorMetadata>>;
	upsert(record: CcipVectorRecord): Promise<void>;
	upsertMany(records: CcipVectorRecord[]): Promise<void>;
	delete(mediaId: string): Promise<void>;
	deleteRegion(regionId: string): Promise<void>;
	deleteEmbedding(key: CcipEmbeddingKey): Promise<void>;
	deleteBySource(mediaSourceId: string): Promise<void>;
	listMediaIds(query?: CcipVectorQuery): Promise<string[]>;
	list(query?: CcipVectorQuery): Promise<CcipVectorRecord[]>;
	search(
		vector: number[],
		limit: number,
		query: CcipVectorReadQuery,
	): Promise<CcipVectorCandidate[]>;
}
