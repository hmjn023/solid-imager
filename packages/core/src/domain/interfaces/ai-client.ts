import type {
	CcipDifferenceResponse,
	CcipFeatureResponse,
	OppaiOracleResponse,
	TaggingResponse,
} from "../tagging/schemas";

/** AI service operations for tagging, embeddings, and CCIP similarity features. */
export type IAiClient = {
	healthCheck(): Promise<boolean>;

	extractImageEmbedding(imageBuffer: ArrayBuffer): Promise<number[]>;

	extractImageEmbeddingByPath(path: string): Promise<number[]>;

	extractTextEmbedding(text: string): Promise<number[]>;

	tagImage(imageBuffer: ArrayBuffer): Promise<TaggingResponse>;

	tagImageByPath(path: string): Promise<TaggingResponse>;

	tagImageOppaiOracleByPath(path: string): Promise<OppaiOracleResponse>;

	extractCcipFeature(imageBuffer: ArrayBuffer): Promise<CcipFeatureResponse>;

	extractCcipFeatureByPath(path: string): Promise<CcipFeatureResponse>;

	calculateCcipDifference(
		feature1: number[],
		feature2: number[],
	): Promise<CcipDifferenceResponse>;

	calculateCcipDistances(
		feature: number[],
		candidates: number[][],
	): Promise<number[]>;

	getBaseUrl?: () => string;
};
