import { implement } from "@orpc/server";
import { searchSnapshotsContract } from "@solid-imager/core/domain/contract/search-snapshots.contract";
import { SearchSnapshotService } from "~/infrastructure/services/search-snapshot-service";

const os = implement(searchSnapshotsContract);

export const searchSnapshotsRouter = os.router({
	capture: os.capture.handler(async ({ input }) => {
		const snapshot = await SearchSnapshotService.capture(input.state);
		return { id: snapshot.id };
	}),
	get: os.get.handler(async ({ input }) => SearchSnapshotService.get(input.id)),
});
