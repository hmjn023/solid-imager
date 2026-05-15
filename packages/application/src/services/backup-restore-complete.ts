import type { BackupSource } from "@solid-imager/db/backup";
import type { JobRepositoryPort } from "../ports/job-repository";

export type BackupRestoreCompleteDeps = {
	jobRepository: JobRepositoryPort;
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

	const sourceId = source.id ?? null;
	await deps.jobRepository.createMany(
		mediaIds.map((mediaId) => ({
			type: "processMedia" as const,
			mediaSourceId: sourceId,
			payload: {
				mediaId,
				sourcePath: rootPath,
				steps: ["generateThumbnail"],
				type: "processMedia" as const,
			},
		})),
	);
}
