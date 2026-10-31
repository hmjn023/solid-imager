import type {
	ClusteringAssignment,
	ClusteringRunSummary,
	ClusteringSnapshotMedia,
} from "@solid-imager/core/domain/characters/schemas";

export type StoredClusteringMedia = {
	record: ClusteringSnapshotMedia;
	assignment: ClusteringAssignment;
};
export type StoredClusteringRun = {
	summary: ClusteringRunSummary;
	media: StoredClusteringMedia[];
};
export interface ICharacterClusteringResultsStore {
	listRuns(): Promise<ClusteringRunSummary[]>;
	loadRun(id: string): Promise<StoredClusteringRun>;
}
