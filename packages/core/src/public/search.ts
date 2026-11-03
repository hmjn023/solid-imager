export type { SearchSnapshotRepository } from "../domain/repositories/search-snapshot-repository";
export type {
	SemanticSearchRequest,
	SimilarityModel,
} from "../domain/search/embedding";
export {
	EMBEDDING_GEMMA_MODEL,
	EMBEDDING_GEMMA_VERSION,
	embeddingExtractionPayloadSchema,
	embeddingResponseSchema,
	embeddingTextRequestSchema,
	embeddingVectorSchema,
	semanticSearchRequestSchema,
	similarityModelSchema,
} from "../domain/search/embedding";
export type {
	SafeSearchSnapshot,
	SearchSnapshot,
	SearchSnapshotState,
} from "../domain/search/history";
export {
	captureSearchSnapshotRequestSchema,
	captureSearchSnapshotResponseSchema,
	safeSearchSnapshotSchema,
	searchSnapshotSchema,
	searchSnapshotStateSchema,
} from "../domain/search/history";
export {
	calculateNextModeState,
	getSearchConditionFromState,
	preparePresetState,
} from "../domain/search/logic";
export type { SearchState } from "../domain/search/schema";
export {
	DEFAULT_SIMILARITY_TOP_K,
	defaultState,
	searchStateSchema,
} from "../domain/search/schema";
export type { SearchGroup, SearchCriterion } from "../domain/search/criteria";
export { searchGroupSchema } from "../domain/search/criteria";
export type { MediaSort } from "../domain/search/sort";
