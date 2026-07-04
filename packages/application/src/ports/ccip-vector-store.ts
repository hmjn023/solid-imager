export type CcipVectorRecord = {
	mediaId: string;
	mediaSourceId: string;
	vector: number[];
	model: string;
	embeddingVersion: number;
	mediaModifiedAt: Date;
	extractedAt: Date;
};

export type CcipVectorCandidate = CcipVectorRecord & {
	cosineDistance: number;
};

export interface ICcipVectorStore {
	get(mediaId: string): Promise<CcipVectorRecord | null>;
	upsert(record: CcipVectorRecord): Promise<void>;
	upsertMany(records: CcipVectorRecord[]): Promise<void>;
	delete(mediaId: string): Promise<void>;
	deleteBySource(mediaSourceId: string): Promise<void>;
	listMediaIds(mediaSourceId?: string): Promise<string[]>;
	list(mediaSourceId?: string): Promise<CcipVectorRecord[]>;
	search(
		vector: number[],
		limit: number,
		mediaSourceId?: string,
	): Promise<CcipVectorCandidate[]>;
}
