import { os } from "@orpc/server";
import {
	createManualMediaRegionSchema,
	deleteMediaRegionSchema,
	materializedMediaRegionSchema,
	materializeMediaRegionSchema,
	safeMediaRegionSchema,
	updateMediaRegionSchema,
} from "@solid-imager/core/domain/media-regions/schemas";
import { z } from "zod";
import { services } from "~/application/registry";
import { toMediaRegionOrpcError } from "~/infrastructure/api/media-region-api-errors";

export const mediaRegionsRouter = {
	list: os
		.input(z.object({ mediaId: z.string().uuid() }))
		.output(z.array(safeMediaRegionSchema))
		.handler(async ({ input }) => {
			try {
				return await services.getMediaRegionService().list(input.mediaId);
			} catch (error) {
				return toMediaRegionOrpcError(error);
			}
		}),
	createManual: os
		.input(createManualMediaRegionSchema)
		.output(safeMediaRegionSchema)
		.handler(async ({ input }) => {
			try {
				return await services.getMediaRegionService().createManual(input);
			} catch (error) {
				return toMediaRegionOrpcError(error);
			}
		}),
	update: os
		.input(updateMediaRegionSchema)
		.output(safeMediaRegionSchema)
		.handler(async ({ input }) => {
			try {
				return await services.getMediaRegionService().update(input);
			} catch (error) {
				return toMediaRegionOrpcError(error);
			}
		}),
	delete: os
		.input(deleteMediaRegionSchema)
		.output(z.object({ success: z.literal(true) }))
		.handler(async ({ input }) => {
			try {
				await services
					.getMediaRegionService()
					.delete(input.regionId, input.expectedRevision);
				return { success: true as const };
			} catch (error) {
				return toMediaRegionOrpcError(error);
			}
		}),
	materialize: os
		.input(materializeMediaRegionSchema)
		.output(materializedMediaRegionSchema)
		.handler(async ({ input }) => {
			try {
				return await services
					.getMediaRegionService()
					.materialize(input.regionId, input.expectedRevision, input.profile);
			} catch (error) {
				return toMediaRegionOrpcError(error);
			}
		}),
};
