import type { BackupSource } from "@solid-imager/db/backup";
import type { ProcessMediaJobRepository } from "../ports/job-repository";

export type BackupRestoreCompleteDeps = {
	jobRepository: ProcessMediaJobRepository;
};

export async function enqueueThumbnailJobsAfterRestore(
	params: {
		source: BackupSource;
		mediaIds: string[];
		rootPath: string;
	},
	deps: BackupRestoreCompleteDeps,
): Promise<void> {
	const { source, mediaIds, rootPath } = params;
	if (source.type !== "local" || mediaIds.length === 0) {
		return;
	}

	const sourceId = source.id ?? "";
	for (const mediaId of mediaIds) {
		await deps.jobRepository.create({
			type: "processMedia",
			mediaSourceId: sourceId,
			payload: {
				mediaId,
				sourcePath: rootPath,
				steps: ["generateThumbnail"],
				type: "processMedia",
			},
		});
	}
}
