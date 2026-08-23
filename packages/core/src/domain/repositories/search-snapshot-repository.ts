import type {
	SearchSnapshot,
	SearchSnapshotState,
} from "@/domain/search/history";

export type SearchSnapshotRepository = {
	get(id: string): Promise<SearchSnapshot | null>;
	getByFingerprint(fingerprint: string): Promise<SearchSnapshot | null>;
	create(data: {
		fingerprint: string;
		state: SearchSnapshotState;
	}): Promise<SearchSnapshot>;
};
