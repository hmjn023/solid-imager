import { and, asc, eq, or } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import { type Job, jobs, type NewJob } from "../../db/schema";
import type {
	MediaProcessingStep,
	PersistedProcessMediaJob,
	ProcessMediaJob,
} from "../../jobs/process-media-job";

const PROCESS_MEDIA_JOB_TYPE = "processMedia";
const AUTO_TAGGING_JOB_TYPE = "auto_tagging";

type AutoTaggingJobPayload = {
	mediaId: string;
	mediaSourceId: string;
};

export type PersistedAutoTaggingJob = {
	id: string;
	mediaId: string;
	mediaSourceId: string;
	status: Job["status"];
	error: string | null;
	createdAt: Date;
	updatedAt: Date;
};

function isAutoTaggingJobPayload(
	value: unknown,
): value is AutoTaggingJobPayload {
	return (
		typeof value === "object" &&
		value !== null &&
		"mediaId" in value &&
		typeof value.mediaId === "string" &&
		"mediaSourceId" in value &&
		typeof value.mediaSourceId === "string"
	);
}

function toPersistedAutoTaggingJob(row: Job): PersistedAutoTaggingJob | null {
	if (!isAutoTaggingJobPayload(row.payload)) {
		console.error(`[jobs] Auto-tagging job ${row.id} has invalid payload.`);
		return null;
	}
	return {
		id: row.id,
		mediaId: row.payload.mediaId,
		mediaSourceId: row.payload.mediaSourceId,
		status: row.status,
		error: row.error,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

type ProcessMediaJobPayload = {
	mediaId: string;
	sourcePath: string;
	steps?: MediaProcessingStep[];
};

function getDb() {
	return getTauriAppServices().db;
}

function isProcessMediaJobPayload(
	value: unknown,
): value is ProcessMediaJobPayload {
	return (
		typeof value === "object" &&
		value !== null &&
		"mediaId" in value &&
		typeof value.mediaId === "string" &&
		"sourcePath" in value &&
		typeof value.sourcePath === "string"
	);
}

function toPersistedProcessMediaJob(row: Job): PersistedProcessMediaJob | null {
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
		steps: row.payload.steps,
		status: row.status,
		error: row.error,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export const TauriJobRepository = {
	async createMany(
		processMediaJobs: ProcessMediaJob[],
	): Promise<PersistedProcessMediaJob[]> {
		if (processMediaJobs.length === 0) {
			return [];
		}

		const now = new Date();
		const values: NewJob[] = processMediaJobs.map((job) => ({
			id: crypto.randomUUID(),
			type: PROCESS_MEDIA_JOB_TYPE,
			mediaSourceId: job.sourceId,
			status: "pending",
			payload: {
				mediaId: job.mediaId,
				sourcePath: job.sourcePath,
				steps: job.steps,
			},
			result: null,
			error: null,
			createdAt: now,
			updatedAt: now,
		}));
		const rows = await getDb().insert(jobs).values(values).returning();

		return rows.flatMap((row) => {
			const job = toPersistedProcessMediaJob(row);
			return job ? [job] : [];
		});
	},

	async createIfUnique(
		job: ProcessMediaJob,
	): Promise<PersistedProcessMediaJob | null> {
		const db = getDb();
		// Check for existing pending or in-progress jobs with the same mediaId
		// Since we don't have a JSON index in SQLite/PGlite yet, we query active jobs and filter in JS
		const activeRows = await db
			.select()
			.from(jobs)
			.where(
				and(
					eq(jobs.type, PROCESS_MEDIA_JOB_TYPE),
					or(eq(jobs.status, "pending"), eq(jobs.status, "in_progress")),
				),
			);

		const existing = activeRows.find((row) => {
			const p = row.payload;
			return (
				typeof p === "object" &&
				p !== null &&
				"mediaId" in p &&
				p.mediaId === job.mediaId
			);
		});

		if (existing) {
			return null;
		}

		const [created] = await this.createMany([job]);
		return created || null;
	},

	async findPending(): Promise<PersistedProcessMediaJob[]> {
		const rows = await getDb()
			.select()
			.from(jobs)
			.where(
				and(eq(jobs.type, PROCESS_MEDIA_JOB_TYPE), eq(jobs.status, "pending")),
			)
			.orderBy(asc(jobs.createdAt));

		return rows.flatMap((row) => {
			const job = toPersistedProcessMediaJob(row);
			return job ? [job] : [];
		});
	},

	async resetInProgressToPending(): Promise<void> {
		await getDb()
			.update(jobs)
			.set({
				status: "pending",
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(jobs.type, PROCESS_MEDIA_JOB_TYPE),
					eq(jobs.status, "in_progress"),
				),
			);
	},

	async markAsInProgress(id: string): Promise<void> {
		await getDb()
			.update(jobs)
			.set({
				status: "in_progress",
				error: null,
				updatedAt: new Date(),
			})
			.where(eq(jobs.id, id));
	},

	async markAsCompleted(id: string): Promise<void> {
		await getDb()
			.update(jobs)
			.set({
				status: "completed",
				error: null,
				updatedAt: new Date(),
			})
			.where(eq(jobs.id, id));
	},

	async markAsFailed(id: string, error: string): Promise<void> {
		await getDb()
			.update(jobs)
			.set({
				status: "failed",
				error,
				updatedAt: new Date(),
			})
			.where(eq(jobs.id, id));
	},

	async createAutoTaggingJob(
		mediaId: string,
		mediaSourceId: string,
	): Promise<PersistedAutoTaggingJob> {
		const db = getDb();
		const activeRows = await db
			.select()
			.from(jobs)
			.where(
				and(
					eq(jobs.type, AUTO_TAGGING_JOB_TYPE),
					or(eq(jobs.status, "pending"), eq(jobs.status, "in_progress")),
				),
			);
		const existing = activeRows.find((row) => {
			const p = row.payload;
			return (
				typeof p === "object" &&
				p !== null &&
				"mediaId" in p &&
				p.mediaId === mediaId
			);
		});
		if (existing) {
			const job = toPersistedAutoTaggingJob(existing);
			if (job) return job;
		}

		const now = new Date();
		const value: NewJob = {
			id: crypto.randomUUID(),
			type: AUTO_TAGGING_JOB_TYPE,
			mediaSourceId,
			status: "pending",
			payload: { mediaId, mediaSourceId },
			result: null,
			error: null,
			createdAt: now,
			updatedAt: now,
		};
		const [row] = await db.insert(jobs).values(value).returning();
		const job = toPersistedAutoTaggingJob(row);
		if (!job)
			throw new Error(`Failed to create auto_tagging job for ${mediaId}`);
		return job;
	},

	async findPendingAutoTagging(): Promise<PersistedAutoTaggingJob[]> {
		const rows = await getDb()
			.select()
			.from(jobs)
			.where(
				and(eq(jobs.type, AUTO_TAGGING_JOB_TYPE), eq(jobs.status, "pending")),
			)
			.orderBy(asc(jobs.createdAt));
		return rows.flatMap((row) => {
			const job = toPersistedAutoTaggingJob(row);
			return job ? [job] : [];
		});
	},

	async resetInProgressAutoTaggingToPending(): Promise<void> {
		await getDb()
			.update(jobs)
			.set({ status: "pending", updatedAt: new Date() })
			.where(
				and(
					eq(jobs.type, AUTO_TAGGING_JOB_TYPE),
					eq(jobs.status, "in_progress"),
				),
			);
	},
};
