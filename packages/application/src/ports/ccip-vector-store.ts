export type CcipVectorRecord = {
	mediaId: string;
	mediaSourceId: string;
	vector: number[];
	model: string;
	embeddingVersion: number;
	mediaModifiedAt: Date;
	extractedAt: Date;
};

export type CcipVectorQuery = {
	mediaSourceId?: string;
	model?: string;
	embeddingVersion?: number;
};

export type CcipVectorMetadata = Omit<CcipVectorRecord, "vector">;

export type CcipVectorCandidate = CcipVectorRecord & {
	cosineDistance: number;
};

export interface ICcipVectorStore {
	get(
		mediaId: string,
		query?: CcipVectorQuery,
	): Promise<CcipVectorRecord | null>;
	getMany(
		mediaIds: string[],
		query?: CcipVectorQuery,
	): Promise<Map<string, CcipVectorRecord>>;
	getMetadataMany(
		mediaIds: string[],
		query?: CcipVectorQuery,
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
		query?: CcipVectorQuery,
	): Promise<CcipVectorCandidate[]>;
}
