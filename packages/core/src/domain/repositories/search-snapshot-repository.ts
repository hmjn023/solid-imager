import type { SearchSnapshot, SearchSnapshotState } from "../search/history";

/** Persistence port for reusable search snapshots and fingerprint lookup. */
export type SearchSnapshotRepository = {
	get(id: string): Promise<SearchSnapshot | null>;
	getByFingerprint(fingerprint: string): Promise<SearchSnapshot | null>;
	create(data: {
		fingerprint: string;
		state: SearchSnapshotState;
	}): Promise<SearchSnapshot>;
};
