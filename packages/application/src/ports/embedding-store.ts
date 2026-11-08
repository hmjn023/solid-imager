import type { SimilarMediaScore } from "@solid-imager/core/tagging";

/** An image embedding with its model, version and source media modification time. */
export type ImageEmbedding = {
	mediaId: string;
	vector: number[];
	model: string;
	version: number;
	mediaModifiedAt: Date;
};

/** Encode images and text into vectors suitable for similarity search. */
export interface IEmbeddingEncoder {
	encodeImage(filePath: string): Promise<number[]>;
	encodeText(text: string): Promise<number[]>;
}

/** Persist image embeddings and retrieve paginated similarity candidates. */
export interface IEmbeddingStore {
	get(mediaId: string): Promise<ImageEmbedding | null>;
	upsert(record: ImageEmbedding): Promise<void>;
	search(
		vector: number[],
		options: {
			mediaSourceId?: string;
			activeOnly?: boolean;
			excludeMediaId?: string;
			limit: number;
			offset: number;
		},
	): Promise<{ candidates: SimilarMediaScore[]; total: number }>;
}

/** Top visual neighbors for a detail view, with no pagination or corpus total. */
export interface RelatedEmbeddingReader extends Pick<IEmbeddingStore, "get"> {
	nearestRelated(
		vector: number[],
		anchorId: string,
		limit: number,
	): Promise<SimilarMediaScore[]>;
}
