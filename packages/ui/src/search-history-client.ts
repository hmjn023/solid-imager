import type { SearchSnapshotsOrpcLike } from "@solid-imager/core/domain/contract/search-snapshots-client";
import type {
	SearchSnapshot,
	SearchSnapshotState,
} from "@solid-imager/core/domain/search/history";

export type SearchHistoryClient = {
	capture: (state: SearchSnapshotState) => Promise<{ id: string }>;
	get: (id: string) => Promise<SearchSnapshot>;
};

export function createSearchHistoryClient(
	orpc: SearchSnapshotsOrpcLike,
): SearchHistoryClient {
	return {
		capture: async (state) => await orpc.searchSnapshots.capture({ state }),
		get: async (id) => await orpc.searchSnapshots.get({ id }),
	};
}
