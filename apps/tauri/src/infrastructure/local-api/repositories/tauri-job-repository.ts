import type { JobRecord } from "@solid-imager/application/ports/job-repository";
import {
	parseMediaProcessingJobPayload,
	toProcessMediaNewJob,
} from "@solid-imager/application/services/media-processing-job";
import { createJobRepository } from "@solid-imager/db/repositories/job-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { getTauriAppServices } from "~/app-services";
import type { PersistedProcessMediaJob, ProcessMediaJob } from "../../jobs/process-media-job";

function getDb(): DrizzleExecutor {
	return getTauriAppServices().db as DrizzleExecutor;
}

const sharedRepository = createJobRepository(getDb);

function toPersistedProcessMediaJob(row: JobRecord): PersistedProcessMediaJob | null {
	const payload = parseMediaProcessingJobPayload(row.payload);
	if (!row.mediaSourceId || !payload) {
		console.error(`[jobs] Job ${row.id} has invalid data or missing mediaSourceId.`);
		return null;
	}

	return {
		id: row.id,
		sourceId: row.mediaSourceId,
		mediaId: payload.mediaId,
		sourcePath: payload.sourcePath,
		steps: payload.steps,
		status: row.status,
		error: row.error,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export const TauriJobRepository = {
	...sharedRepository,

	async createManyProcessMedia(
		processMediaJobs: ProcessMediaJob[],
	): Promise<PersistedProcessMediaJob[]> {
		const rows = await sharedRepository.createMany(processMediaJobs.map(toProcessMediaNewJob));
		return rows.flatMap((row) => {
			const job = toPersistedProcessMediaJob(row);
			return job ? [job] : [];
		});
	},

	async createUniqueProcessMedia(job: ProcessMediaJob): Promise<PersistedProcessMediaJob | null> {
		const row = await sharedRepository.createIfUnique(toProcessMediaNewJob(job));
		return row ? toPersistedProcessMediaJob(row) : null;
	},
};
