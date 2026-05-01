import type { DownloadItem } from "@solid-imager/core/domain/media/schemas";
import type { JobRecord, JobRepositoryPort } from "../ports/job-repository";
import { createTimestamp, type MediaSourceEventPublisher } from "./runtime-events";

export type DownloadJobMode = "direct" | "specialized";

export type DownloadArtifact = {
	mediaSourceId: string;
	filePath: string;
	fileName: string;
	mediaType: "image" | "video" | "audio";
	width: number;
	height: number;
	fileSize: number | null;
	description: string | null;
	createdAt: Date;
	modifiedAt: Date;
	sourceUrls?: string[];
};

export type DownloadRunnerDeps = {
	resolveBasePath(mediaSourceId: string): Promise<string>;
	selectMode(item: DownloadItem): DownloadJobMode;
	download(
		item: DownloadItem,
		context: {
			mediaSourceId: string;
			basePath: string;
			mode: DownloadJobMode;
		},
	): Promise<DownloadArtifact[]>;
	registerMedia(
		artifact: DownloadArtifact,
		context: {
			item: DownloadItem;
			mediaSourceId: string;
			basePath: string;
		},
	): Promise<void>;
	events: Pick<MediaSourceEventPublisher, "downloadError">;
	logger?: {
		error?(data: unknown, message?: string): void;
		info?(data: unknown, message?: string): void;
	};
};

export function getDownloadItemFromJob(job: Pick<JobRecord, "payload">): DownloadItem {
	if (!job.payload || typeof job.payload !== "object") {
		return {} as DownloadItem;
	}

	const payload = job.payload as Record<string, unknown>;
	const item = { ...payload } as DownloadItem;

	if (!item.targetUrl && typeof payload.imageUrl === "string") {
		item.targetUrl = payload.imageUrl;
	}
	if (!item.description && typeof payload.description === "string") {
		item.description = payload.description;
	}
	if (!item.sourceUrls) {
		item.sourceUrls = typeof payload.sourceUrl === "string" ? [payload.sourceUrl] : [];
	}

	return item;
}

export async function queueDownloadJobs(
	jobRepository: Pick<JobRepositoryPort, "create">,
	mediaSourceId: string,
	items: DownloadItem[],
): Promise<number> {
	for (const item of items) {
		let createdAt: Date | undefined = item.createdAt ? new Date(item.createdAt) : undefined;
		if (createdAt && Number.isNaN(createdAt.getTime())) {
			createdAt = undefined;
		}

		await jobRepository.create({
			type: "downloadImage",
			mediaSourceId,
			payload: {
				...item,
				imageUrl: item.targetUrl,
				sourceUrl: item.targetUrl,
				createdAt,
			},
		});
	}

	return items.length;
}

export async function runDownloadImageJob(job: JobRecord, deps: DownloadRunnerDeps): Promise<void> {
	if (!job.mediaSourceId) {
		throw new Error(`Job ${job.id} missing mediaSourceId`);
	}

	const item = getDownloadItemFromJob(job);
	if (!item.targetUrl) {
		throw new Error("Job payload missing targetUrl");
	}

	try {
		const basePath = await deps.resolveBasePath(job.mediaSourceId);
		const mode = deps.selectMode(item);
		deps.logger?.info?.(
			{ jobId: job.id, mediaSourceId: job.mediaSourceId, mode },
			"Starting shared download job",
		);
		const artifacts = await deps.download(item, {
			mediaSourceId: job.mediaSourceId,
			basePath,
			mode,
		});

		for (const artifact of artifacts) {
			await deps.registerMedia(artifact, {
				item,
				mediaSourceId: job.mediaSourceId,
				basePath,
			});
		}
	} catch (error) {
		await deps.events.downloadError?.({
			mediaSourceId: job.mediaSourceId,
			url: item.targetUrl,
			error: error instanceof Error ? error.message : String(error),
			timestamp: createTimestamp(),
		});
		deps.logger?.error?.(
			{ err: error, jobId: job.id, mediaSourceId: job.mediaSourceId },
			"Shared download job failed",
		);
		throw error;
	}
}
