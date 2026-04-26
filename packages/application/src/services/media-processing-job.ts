import type { NewJobRecord, ProcessMediaJobRepository } from "../ports/job-repository";

export const MEDIA_PROCESSING_STEPS = [
	"extractMetadata",
	"generateThumbnail",
	"queueAutoTagging",
] as const;

export type MediaProcessingStep = (typeof MEDIA_PROCESSING_STEPS)[number];

export type MediaProcessingJobPayload = {
	mediaId: string;
	sourcePath: string;
	steps?: MediaProcessingStep[];
	type?: "processMedia";
};

export type ProcessMediaJob = {
	sourceId: string;
	mediaId: string;
	sourcePath: string;
	steps?: MediaProcessingStep[];
};

export type QueueMediaProcessingJobInput = {
	jobRepo: ProcessMediaJobRepository;
	mediaId: string;
	mediaSourceId: string;
	sourcePath: string;
	steps?: MediaProcessingStep[];
};

export function parseMediaProcessingJobPayload(payload: unknown): MediaProcessingJobPayload | null {
	if (
		typeof payload !== "object" ||
		payload === null ||
		!("mediaId" in payload) ||
		typeof payload.mediaId !== "string" ||
		!("sourcePath" in payload) ||
		typeof payload.sourcePath !== "string"
	) {
		return null;
	}

	const steps =
		"steps" in payload && Array.isArray(payload.steps)
			? payload.steps.filter((step): step is MediaProcessingStep =>
					MEDIA_PROCESSING_STEPS.includes(step as MediaProcessingStep),
				)
			: undefined;

	return {
		mediaId: payload.mediaId,
		sourcePath: payload.sourcePath,
		steps,
		type: "type" in payload && payload.type === "processMedia" ? "processMedia" : undefined,
	};
}

export function toProcessMediaNewJob(job: ProcessMediaJob): NewJobRecord {
	return {
		type: "processMedia",
		mediaSourceId: job.sourceId,
		payload: {
			mediaId: job.mediaId,
			sourcePath: job.sourcePath,
			steps: job.steps,
			type: "processMedia",
		} satisfies MediaProcessingJobPayload,
	};
}

export function getMediaProcessingSteps(
	payload: MediaProcessingJobPayload | null | undefined,
): ReadonlyArray<MediaProcessingStep> {
	return payload?.steps?.length ? payload.steps : MEDIA_PROCESSING_STEPS;
}

export function hasMediaProcessingStep(
	payload: MediaProcessingJobPayload | null | undefined,
	step: MediaProcessingStep,
): boolean {
	return getMediaProcessingSteps(payload).includes(step);
}

export async function queueMediaProcessingJob({
	jobRepo,
	mediaId,
	mediaSourceId,
	sourcePath,
	steps,
}: QueueMediaProcessingJobInput): Promise<void> {
	await jobRepo.create({
		...toProcessMediaNewJob({
			sourceId: mediaSourceId,
			mediaId,
			sourcePath,
			steps,
		}),
	});
}
