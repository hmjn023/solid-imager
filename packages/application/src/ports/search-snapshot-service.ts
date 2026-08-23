import type {
	SearchSnapshot,
	SearchSnapshotState,
} from "@solid-imager/core/domain/search/history";

export interface ISearchSnapshotService {
	capture(state: SearchSnapshotState): Promise<SearchSnapshot>;
	get(id: string): Promise<SearchSnapshot>;
}
