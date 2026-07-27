import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	createManualMediaRegionSchema,
	deleteMediaRegionSchema,
	materializedMediaRegionSchema,
	materializeMediaRegionSchema,
	safeMediaRegionSchema,
	updateMediaRegionSchema,
} from "../media-regions/schemas";

export const mediaRegionsContract = {
	list: oc
		.input(z.object({ mediaId: z.string().uuid() }))
		.output(z.array(safeMediaRegionSchema)),
	createManual: oc
		.input(createManualMediaRegionSchema)
		.output(safeMediaRegionSchema),
	update: oc.input(updateMediaRegionSchema).output(safeMediaRegionSchema),
	delete: oc
		.input(deleteMediaRegionSchema)
		.output(z.object({ success: z.literal(true) })),
	materialize: oc
		.input(materializeMediaRegionSchema)
		.output(materializedMediaRegionSchema),
};
