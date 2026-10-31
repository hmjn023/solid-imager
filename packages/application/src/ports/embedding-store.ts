import type { SimilarMediaScore } from "@solid-imager/core/domain/tagging/schemas";

export type ImageEmbedding = {
	mediaId: string;
	vector: number[];
	model: string;
	version: number;
	mediaModifiedAt: Date;
};

export interface IEmbeddingEncoder {
	encodeImage(filePath: string): Promise<number[]>;
	encodeText(text: string): Promise<number[]>;
}

export interface IEmbeddingStore {
	get(mediaId: string): Promise<ImageEmbedding | null>;
	upsert(record: ImageEmbedding): Promise<void>;
	search(
		vector: number[],
		options: {
			mediaSourceId?: string;
			excludeMediaId?: string;
			limit: number;
			offset: number;
		},
	): Promise<{ candidates: SimilarMediaScore[]; total: number }>;
}
