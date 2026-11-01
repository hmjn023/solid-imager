import type { RouterContractClient } from "@orpc/contract";
import type { searchSnapshotsContract } from "./search-snapshots.contract";

export type SearchSnapshotsOrpcLike = {
	searchSnapshots: RouterContractClient<typeof searchSnapshotsContract>;
};
