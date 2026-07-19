import type {
	CcipDifferenceResponse,
	CcipFeatureResponse,
	OppaiOracleResponse,
	TaggingResponse,
} from "@/domain/tagging/schemas";

export type IAiClient = {
	healthCheck(): Promise<boolean>;

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
