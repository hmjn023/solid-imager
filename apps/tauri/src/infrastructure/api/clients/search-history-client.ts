import type { SearchSnapshotsOrpcLike } from "@solid-imager/core/contract";
import { client } from "~/orpc-client";

export const SearchHistoryClient: SearchSnapshotsOrpcLike = {
	searchSnapshots: client.searchSnapshots,
};
