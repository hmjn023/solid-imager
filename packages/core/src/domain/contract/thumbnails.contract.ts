import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	generateThumbnailsRequestSchema,
	generateThumbnailsResponseSchema,
} from "../thumbnails/schemas";

export const thumbnailsContract = {
	generate: oc
		.input(generateThumbnailsRequestSchema)
		.output(generateThumbnailsResponseSchema),

	clear: oc.input(z.object({ sourceId: z.string().uuid() })),
};
