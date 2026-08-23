import type { SearchSnapshotsOrpcLike } from "@solid-imager/core/domain/contract/search-snapshots-client";
import { client } from "~/orpc-client";

export const SearchHistoryClient: SearchSnapshotsOrpcLike = {
	searchSnapshots: client.searchSnapshots,
};
