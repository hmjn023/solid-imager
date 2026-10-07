import { createMediaProcessingStateRepository } from "@solid-imager/db/repositories/media-processing-state-repository";
import { getExecutor } from "~/infrastructure/db/executor";
export const MediaProcessingStateRepository =
	createMediaProcessingStateRepository(getExecutor);
