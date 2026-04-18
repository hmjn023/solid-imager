import { and, asc, eq } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import { type Job, jobs, type NewJob } from "../../db/schema";
import type {
	PersistedThumbnailJob,
	ThumbnailJob,
} from "../../jobs/thumbnail-job";

const THUMBNAIL_JOB_TYPE = "thumbnail_generation";

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

function toPersistedThumbnailJob(row: Job): PersistedThumbnailJob {
	if (!row.mediaSourceId) {
		throw new Error(`Job ${row.id} is missing mediaSourceId.`);
	}
	if (!isThumbnailJobPayload(row.payload)) {
		throw new Error(`Job ${row.id} has invalid thumbnail payload.`);
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

		return rows.map(toPersistedThumbnailJob);
	},

	async findPending(): Promise<PersistedThumbnailJob[]> {
		const rows = await getDb()
			.select()
			.from(jobs)
			.where(and(eq(jobs.type, THUMBNAIL_JOB_TYPE), eq(jobs.status, "pending")))
			.orderBy(asc(jobs.createdAt));

		return rows.map(toPersistedThumbnailJob);
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
};
