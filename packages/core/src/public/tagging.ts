export { DEFAULT_MANUAL_CONFIDENCE } from "../domain/tagging/constants";
export type {
	AiHealthResponse,
	CcipDifferenceResponse,
	CcipFeatureResponse,
	CcipVectorStatus,
	CharacterCrop,
	DetectAndCropResponse,
	NapiBBox,
	OppaiOracleResponse,
	SimilarMediaScore,
	StartCcipExtractionResponse,
	TaggingResponse,
} from "../domain/tagging/schemas";
export {
	batchCcipExtractionRequestSchema,
	batchParentPayloadSchema,
	ccipDifferenceResponseSchema,
	ccipExtractionRequestSchema,
	ccipFeatureResponseSchema,
	detectAndCropResponseSchema,
	oppaiOracleResponseSchema,
	startCcipExtractionResponseSchema,
	tagImageRequestSchema,
	taggingResponseSchema,
} from "../domain/tagging/schemas";

export {
	CCIP_DIMENSIONS,
	CCIP_EMBEDDING_VERSION,
	CCIP_MODEL,
} from "../domain/tagging/ccip";
