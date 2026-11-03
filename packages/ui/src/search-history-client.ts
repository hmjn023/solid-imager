import type { SearchSnapshotsOrpcLike } from "@solid-imager/core/contract";
import type {
	SafeSearchSnapshot,
	SearchSnapshotState,
} from "@solid-imager/core/search";

export type SearchHistoryClient = {
	capture: (state: SearchSnapshotState) => Promise<{ id: string }>;
	get: (id: string) => Promise<SafeSearchSnapshot>;
};

export function createSearchHistoryClient(
	orpc: SearchSnapshotsOrpcLike,
): SearchHistoryClient {
	return {
		capture: async (state) => await orpc.searchSnapshots.capture({ state }),
		get: async (id) => await orpc.searchSnapshots.get({ id }),
	};
}
