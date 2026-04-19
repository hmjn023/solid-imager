import { and, asc, eq } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import { type Job, jobs, type NewJob } from "../../db/schema";
import type {
	PersistedThumbnailJob,
	ThumbnailJob,
} from "../../jobs/thumbnail-job";

const THUMBNAIL_JOB_TYPE = "thumbnail_generation";
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

function toPersistedAutoTaggingJob(
	row: Job,
): PersistedAutoTaggingJob | null {
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

type ThumbnailJobPayload = {
	mediaId: string;
	filePath: string;
	fullPath: string;
};

function getDb() {
	return getTauriAppServices().db;
}

function isThumbnailJobPayload(value: unknown): value is ThumbnailJobPayload {
	return (
		typeof value === "object" &&
		value !== null &&
		"mediaId" in value &&
		typeof value.mediaId === "string" &&
		"filePath" in value &&
		typeof value.filePath === "string" &&
		"fullPath" in value &&
		typeof value.fullPath === "string"
	);
}

function toPersistedThumbnailJob(row: Job): PersistedThumbnailJob | null {
	if (!row.mediaSourceId || !isThumbnailJobPayload(row.payload)) {
		console.error(
			`[jobs] Job ${row.id} has invalid data or missing mediaSourceId.`,
		);
		return null;
	}

	return {
		id: row.id,
		sourceId: row.mediaSourceId,
		mediaId: row.payload.mediaId,
		filePath: row.payload.filePath,
		fullPath: row.payload.fullPath,
		status: row.status,
		error: row.error,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export const TauriJobRepository = {
	async createMany(
		thumbnailJobs: ThumbnailJob[],
	): Promise<PersistedThumbnailJob[]> {
		if (thumbnailJobs.length === 0) {
			return [];
		}

		const now = new Date();
		const values: NewJob[] = thumbnailJobs.map((job) => ({
			id: crypto.randomUUID(),
			type: THUMBNAIL_JOB_TYPE,
			mediaSourceId: job.sourceId,
			status: "pending",
			payload: {
				mediaId: job.mediaId,
				filePath: job.filePath,
				fullPath: job.fullPath,
			},
			result: null,
			error: null,
			createdAt: now,
			updatedAt: now,
		}));
		const rows = await getDb().insert(jobs).values(values).returning();

		return rows.flatMap((row) => {
			const job = toPersistedThumbnailJob(row);
			return job ? [job] : [];
		});
	},

	async findPending(): Promise<PersistedThumbnailJob[]> {
		const rows = await getDb()
			.select()
			.from(jobs)
			.where(and(eq(jobs.type, THUMBNAIL_JOB_TYPE), eq(jobs.status, "pending")))
			.orderBy(asc(jobs.createdAt));

		return rows.flatMap((row) => {
			const job = toPersistedThumbnailJob(row);
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
				and(eq(jobs.type, THUMBNAIL_JOB_TYPE), eq(jobs.status, "in_progress")),
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
		const [row] = await getDb().insert(jobs).values(value).returning();
		const job = toPersistedAutoTaggingJob(row);
		if (!job) throw new Error(`Failed to create auto_tagging job for ${mediaId}`);
		return job;
	},

	async findPendingAutoTagging(): Promise<PersistedAutoTaggingJob[]> {
		const rows = await getDb()
			.select()
			.from(jobs)
			.where(
				and(
					eq(jobs.type, AUTO_TAGGING_JOB_TYPE),
					eq(jobs.status, "pending"),
				),
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
