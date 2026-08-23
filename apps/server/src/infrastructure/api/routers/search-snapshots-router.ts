import { implement } from "@orpc/server";
import { searchSnapshotsContract } from "@solid-imager/core/domain/contract/search-snapshots.contract";
import type { SearchSnapshot } from "@solid-imager/core/domain/search/history";
import { safeSearchSnapshotSchema } from "@solid-imager/core/domain/search/history";
import { SearchSnapshotService } from "~/infrastructure/services/search-snapshot-service";

const os = implement(searchSnapshotsContract);

function toSafeSearchSnapshot(snapshot: SearchSnapshot) {
	const { state } = snapshot;
	return safeSearchSnapshotSchema.parse({
		id: snapshot.id,
		version: snapshot.version,
		state: {
			mode: state.mode,
			searchQuery: state.searchQuery,
			selectedTags: state.selectedTags,
			excludeTags: state.excludeTags,
			tagMode: state.tagMode,
			selectedSource: state.selectedSource,
			selectedProjects: state.selectedProjects,
			selectedIps: state.selectedIps,
			selectedCharacters: state.selectedCharacters,
			selectedAuthors: state.selectedAuthors,
			advancedCondition: state.advancedCondition,
			similarityAnchorMediaId: state.similarityAnchorMediaId,
			similarityTopK: state.similarityTopK,
			limit: state.limit,
			sortBy: state.sortBy,
			sortOrder: state.sortOrder,
		},
	});
}

export const searchSnapshotsRouter = os.router({
	capture: os.capture.handler(async ({ input }) => {
		const snapshot = await SearchSnapshotService.capture(input.state);
		return { id: snapshot.id };
	}),
	get: os.get.handler(async ({ input }) =>
		toSafeSearchSnapshot(await SearchSnapshotService.get(input.id)),
	),
});
