import type {
	CcipDifferenceResponse,
	CcipFeatureResponse,
	DetectAndCropResponse,
	OppaiOracleResponse,
	TaggingResponse,
} from "../tagging/schemas";

/** AI service operations for tagging, embeddings, and CCIP similarity features. */
export type IAiClient = {
	healthCheck(): Promise<boolean>;

	extractImageEmbedding(image: File | ArrayBuffer): Promise<number[]>;

	extractImageEmbeddingByPath(path: string): Promise<number[]>;

	extractTextEmbedding(text: string): Promise<number[]>;

	tagImage(imageBuffer: ArrayBuffer): Promise<TaggingResponse>;

	tagImageByPath(path: string): Promise<TaggingResponse>;

	tagImageOppaiOracle(file: File): Promise<OppaiOracleResponse>;

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

	detectAndCropCharacters(
		file: File,
		transparent: boolean,
	): Promise<DetectAndCropResponse>;

	detectAndCropCharactersByPath(
		path: string,
		transparent: boolean,
	): Promise<DetectAndCropResponse>;

	offload(): Promise<void>;
};
