import type { SearchSnapshotsOrpcLike } from "@solid-imager/core/contract";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

export const SearchHistoryClient: SearchSnapshotsOrpcLike = {
	searchSnapshots: orpc.searchSnapshots,
};
