import { createHash } from "node:crypto";
import {
	serializeMediaProcessingInput,
	type MediaProcessingInput,
	type TaggingProcessingSettings,
} from "@solid-imager/core/domain/processing/schemas";

/** Result identity depends on indexed input and the Solid Imager model version, not execution location. */
export function getTaggingTaskRevision(
	input: MediaProcessingInput,
	settings: TaggingProcessingSettings,
): string {
	return (
		"tagging:" +
		createHash("sha256")
			.update(
				JSON.stringify([
					"tagging-v1",
					serializeMediaProcessingInput(input),
					input.mediaType,
					settings.model,
					settings.modelVersion,
				]),
			)
			.digest("hex")
	);
}
