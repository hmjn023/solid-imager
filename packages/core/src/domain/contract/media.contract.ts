import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	findDuplicatesRequestSchema,
	findDuplicatesResponseSchema,
	mediaDetailsSchema,
	mediaSchema,
	mediaSearchRequestSchema,
	mediaSearchResponseSchema,
	updateMediaRequestSchema,
} from "../media/schemas";

export const mediaContract = {
	search: oc
		.input(
			z.object({
				sourceId: z.string().uuid().nullish(),
				params: mediaSearchRequestSchema,
			}),
		)
		.output(mediaSearchResponseSchema),

	get: oc
		.input(
			z.object({
				sourceId: z.string().uuid(),
				mediaId: z.string().uuid(),
			}),
		)
		.output(mediaSchema),

	getDetails: oc
		.input(
			z.object({
				sourceId: z.string().uuid(),
				mediaId: z.string().uuid(),
			}),
		)
		.output(mediaDetailsSchema),

	getContent: oc
		.input(
			z.object({
				sourceId: z.string().uuid(),
				mediaId: z.string().uuid(),
			}),
		),

	getTags: oc
		.input(
			z.object({
				sourceId: z.string().uuid(),
				mediaId: z.string().uuid(),
			}),
		),

	update: oc
		.input(
			z.object({
				sourceId: z.string().uuid(),
				mediaId: z.string().uuid(),
				data: updateMediaRequestSchema,
			}),
		),

	sync: oc
		.input(
			z.object({
				sourceId: z.string().uuid(),
				mediaIds: z.array(z.string().uuid()),
			}),
		)
		.output(
			z.object({
				results: z.array(
					z.object({
						id: z.string(),
						success: z.boolean(),
						error: z.string().optional(),
					}),
				),
			}),
		),

	delete: oc
		.input(
			z.object({
				sourceId: z.string().uuid(),
				mediaId: z.string().uuid(),
			}),
		)
		.output(z.object({ success: z.boolean() })),

	copy: oc
		.input(
			z.object({
				mediaId: z.string().uuid(),
				targetSourceId: z.string().uuid(),
			}),
		),

	move: oc
		.input(
			z.object({
				mediaId: z.string().uuid(),
				targetSourceId: z.string().uuid(),
			}),
		),

	upload: oc
		.input(
			z.object({
				sourceId: z.string().uuid(),
				file: z.instanceof(File),
				filename: z.string().optional(),
				description: z.string().optional(),
				sourceUrl: z.string().optional(),
				overwrite: z.string().optional(),
				autoIncrement: z.string().optional(),
			}),
		),

	findDuplicates: oc
		.input(findDuplicatesRequestSchema.optional())
		.output(findDuplicatesResponseSchema),
};
