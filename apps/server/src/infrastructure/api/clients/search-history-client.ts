import type { SearchSnapshotsOrpcLike } from "@solid-imager/core/domain/contract/search-snapshots-client";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

export const SearchHistoryClient: SearchSnapshotsOrpcLike = {
	searchSnapshots: orpc.searchSnapshots,
};
