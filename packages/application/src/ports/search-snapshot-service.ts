import type {
	SearchSnapshot,
	SearchSnapshotState,
} from "@solid-imager/core/search";

/** Capture search state for later retrieval by snapshot ID. */
export interface ISearchSnapshotService {
	capture(state: SearchSnapshotState): Promise<SearchSnapshot>;
	get(id: string): Promise<SearchSnapshot>;
}
