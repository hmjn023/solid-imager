import type {
	JobRecord,
	NewJobRecord,
} from "@solid-imager/application/ports/job-repository";
import { createJobRepository } from "@solid-imager/db/repositories/job-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { getTauriAppServices } from "~/app-services";
import type {
	MediaProcessingStep,
	PersistedProcessMediaJob,
	ProcessMediaJob,
} from "../../jobs/process-media-job";
import { MEDIA_PROCESSING_STEPS } from "../../jobs/process-media-job";

const PROCESS_MEDIA_JOB_TYPE = "processMedia";

function getDb(): DrizzleExecutor {
	return getTauriAppServices().db as DrizzleExecutor;
}

const sharedRepository = createJobRepository(getDb);

function isProcessMediaJobPayload(
	value: unknown,
): value is { mediaId: string; sourcePath: string; steps?: unknown } {
	return (
		typeof value === "object" &&
		value !== null &&
		"mediaId" in value &&
		typeof value.mediaId === "string" &&
		"sourcePath" in value &&
		typeof value.sourcePath === "string"
	);
}

function toMediaProcessingSteps(
	value: unknown,
): MediaProcessingStep[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}
	const steps = value.filter((step): step is MediaProcessingStep =>
		MEDIA_PROCESSING_STEPS.includes(step as MediaProcessingStep),
	);
	return steps.length > 0 ? steps : undefined;
}

function toPersistedProcessMediaJob(
	row: JobRecord,
): PersistedProcessMediaJob | null {
	if (!row.mediaSourceId || !isProcessMediaJobPayload(row.payload)) {
		console.error(
			`[jobs] Job ${row.id} has invalid data or missing mediaSourceId.`,
		);
		return null;
	}

	return {
		id: row.id,
		sourceId: row.mediaSourceId,
		mediaId: row.payload.mediaId,
		sourcePath: row.payload.sourcePath,
		steps: toMediaProcessingSteps(row.payload.steps),
		status: row.status,
		error: row.error,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function toProcessMediaNewJob(job: ProcessMediaJob): NewJobRecord {
	return {
		type: PROCESS_MEDIA_JOB_TYPE,
		mediaSourceId: job.sourceId,
		payload: {
			mediaId: job.mediaId,
			sourcePath: job.sourcePath,
			steps: job.steps,
			type: PROCESS_MEDIA_JOB_TYPE,
		},
	};
}

export const TauriJobRepository = {
	...sharedRepository,

	async createManyProcessMedia(
		processMediaJobs: ProcessMediaJob[],
	): Promise<PersistedProcessMediaJob[]> {
		const rows = await sharedRepository.createMany(
			processMediaJobs.map(toProcessMediaNewJob),
		);
		return rows.flatMap((row) => {
			const job = toPersistedProcessMediaJob(row);
			return job ? [job] : [];
		});
	},

	async createUniqueProcessMedia(
		job: ProcessMediaJob,
	): Promise<PersistedProcessMediaJob | null> {
		const row = await sharedRepository.createIfUnique(
			toProcessMediaNewJob(job),
		);
		return row ? toPersistedProcessMediaJob(row) : null;
	},
};
