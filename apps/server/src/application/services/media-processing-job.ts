import type { IJobRepository } from "~/domain/repositories/job-repository";

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

type QueueMediaProcessingJobInput = {
	jobRepo: IJobRepository;
	mediaId: string;
	mediaSourceId: string;
	sourcePath: string;
	steps?: MediaProcessingStep[];
};

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
		type: "processMedia",
		mediaSourceId,
		payload: {
			mediaId,
			sourcePath,
			steps,
			type: "processMedia",
		} satisfies MediaProcessingJobPayload,
	});
}
