import type {
	CcipDifferenceResponse,
	CcipFeatureResponse,
	OppaiOracleResponse,
	TaggingResponse,
} from "@/domain/tagging/schemas";

export type IAiClient = {
	healthCheck(): Promise<boolean>;

	tagImage(imageBuffer: ArrayBuffer, signal?: AbortSignal): Promise<TaggingResponse>;

	tagImageByPath(path: string, signal?: AbortSignal): Promise<TaggingResponse>;

	tagImageOppaiOracleByPath(path: string): Promise<OppaiOracleResponse>;

	extractCcipFeature(
		imageBuffer: ArrayBuffer,
		signal?: AbortSignal,
	): Promise<CcipFeatureResponse>;

	extractCcipFeatureByPath(
		path: string,
		signal?: AbortSignal,
	): Promise<CcipFeatureResponse>;

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
