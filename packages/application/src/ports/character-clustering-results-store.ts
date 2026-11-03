import type {
	ClusteringAssignment,
	ClusteringRunSummary,
	ClusteringSnapshotMedia,
} from "@solid-imager/core/domain/characters/schemas";

/** A snapshot media record paired with its clustering assignment. */
export type StoredClusteringMedia = {
	record: ClusteringSnapshotMedia;
	assignment: ClusteringAssignment;
};
/** A clustering run summary and its saved media assignments. */
export type StoredClusteringRun = {
	summary: ClusteringRunSummary;
	media: StoredClusteringMedia[];
};
/** Reads saved clustering runs and their per-media assignments. */
export interface ICharacterClusteringResultsStore {
	listRuns(): Promise<ClusteringRunSummary[]>;
	loadRun(id: string): Promise<StoredClusteringRun>;
}
