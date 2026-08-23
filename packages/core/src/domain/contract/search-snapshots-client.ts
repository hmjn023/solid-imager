import type { ContractRouterClient } from "@orpc/contract";
import type { searchSnapshotsContract } from "./search-snapshots.contract";

export type SearchSnapshotsOrpcLike = {
	searchSnapshots: ContractRouterClient<typeof searchSnapshotsContract>;
};
