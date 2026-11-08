/** An extracted CCIP vector and the model and media timestamps needed to assess freshness. */
export type CcipVectorRecord = {
	mediaId: string;
	mediaSourceId: string;
	vector: number[];
	model: string;
	embeddingVersion: number;
	mediaModifiedAt: Date;
	extractedAt: Date;
};

/** Optional filters for listing records within a CCIP vector space. */
export type CcipVectorQuery = {
	mediaSourceId?: string;
	model?: string;
	embeddingVersion?: number;
};

/** Query used by reads that must not mix embedding spaces. */
export type CcipVectorReadQuery = {
	mediaSourceId?: string;
	model: string;
	embeddingVersion: number;
};

/** Stored vector metadata without the vector payload. */
export type CcipVectorMetadata = Omit<CcipVectorRecord, "vector">;

/** A candidate media ID and its cosine distance from the query vector. */
export type CcipVectorCandidate = {
	mediaId: string;
	cosineDistance: number;
};

/** Persistence and similarity search for CCIP vectors, partitioned by model and version on reads. */
export interface ICcipVectorStore {
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
	deleteBySource(mediaSourceId: string): Promise<void>;
	listMediaIds(query?: CcipVectorQuery): Promise<string[]>;
	list(query?: CcipVectorQuery): Promise<CcipVectorRecord[]>;
	search(
		vector: number[],
		limit: number,
		query: CcipVectorReadQuery,
		offset: number,
		anchorMediaId: string,
	): Promise<{ candidates: CcipVectorCandidate[]; total: number }>;
}
