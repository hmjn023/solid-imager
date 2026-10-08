import { createHash } from "node:crypto";
import {
	serializeMediaProcessingInput,
	type MediaProcessingInput,
	type TaggingProcessingSettings,
} from "@solid-imager/core/domain/processing/schemas";

/** Fixed field order; bump tagging-v1 when preprocessing or output semantics change. */
export function getTaggingTaskRevision(
	input: MediaProcessingInput,
	settings: TaggingProcessingSettings,
): string {
	return createHash("sha256")
		.update(
			JSON.stringify([
				"tagging-v1",
				serializeMediaProcessingInput(input),
				input.mediaType,
				settings.model,
				settings.modelVersion,
				settings.runtimeVersion,
				settings.provider,
				settings.device,
				settings.endpoint,
			]),
		)
		.digest("hex");
}
