import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	bulkDeleteMediaRequestSchema,
	findDuplicatesRequestSchema,
	findDuplicatesResponseSchema,
	mediaDetailsSchema,
	mediaSchema,
	mediaSearchRequestSchema,
	mediaSearchResponseSchema,
	tagSchema,
	updateMediaRequestSchema,
} from "../media/schemas";
import { uploadResponseSchema } from "../media/upload-schemas";

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
		)
		.output(z.never()),

	getTags: oc
		.input(
			z.object({
				sourceId: z.string().uuid(),
				mediaId: z.string().uuid(),
			}),
		)
		.output(z.array(tagSchema)),

	update: oc
		.input(
			z.object({
				sourceId: z.string().uuid(),
				mediaId: z.string().uuid(),
				data: updateMediaRequestSchema,
			}),
		)
		.output(mediaSchema),

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
		)
		.output(z.object({ success: z.boolean() })),

	move: oc
		.input(
			z.object({
				mediaId: z.string().uuid(),
				targetSourceId: z.string().uuid(),
			}),
		)
		.output(z.object({ success: z.boolean() })),

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
		)
		.output(uploadResponseSchema),

	findDuplicates: oc
		.input(findDuplicatesRequestSchema.optional())
		.output(findDuplicatesResponseSchema),

	bulkDelete: oc
		.input(bulkDeleteMediaRequestSchema)
		.output(z.object({ success: z.boolean() })),
};
