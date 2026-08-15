import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	bulkCopyToSourceMediaRequestSchema,
	bulkDeleteMediaRequestSchema,
	bulkEditMediaRequestSchema,
	bulkMoveMediaRequestSchema,
	bulkMoveToSourceMediaRequestSchema,
	bulkTagMediaRequestSchema,
	findDuplicatesRequestSchema,
	findDuplicatesResponseSchema,
	mediaDetailsSchema,
	mediaSchema,
	mediaSearchRequestSchema,
	mediaSearchResponseSchema,
	similarMediaSearchResponseSchema,
	tagSchema,
	updateMediaRequestSchema,
} from "../media/schemas";
import { uploadResponseSchema } from "../media/upload-schemas";
import { similarMediaRequestSchema } from "../tagging/schemas";

export const mediaContract = {
	search: oc
		.input(
			z.object({
				sourceId: z.string().uuid().nullish(),
				params: mediaSearchRequestSchema,
			}),
		)
		.output(mediaSearchResponseSchema),

	searchSimilar: oc
		.input(similarMediaRequestSchema)
		.output(similarMediaSearchResponseSchema),

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
		.meta({
			openapi: {
				tags: ["Media"],
				summary: "Sync (reprocess) media metadata",
				description: "Re-extract metadata and tags for specified media items",
			},
		})
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

	bulkEdit: oc
		.input(bulkEditMediaRequestSchema)
		.output(z.object({ success: z.boolean() })),

	bulkMove: oc
		.input(bulkMoveMediaRequestSchema)
		.output(z.object({ success: z.boolean() })),

	bulkTag: oc
		.input(bulkTagMediaRequestSchema)
		.output(z.object({ success: z.boolean() })),

	bulkCopyToSource: oc
		.input(bulkCopyToSourceMediaRequestSchema)
		.output(z.object({ success: z.boolean() })),

	bulkMoveToSource: oc
		.input(bulkMoveToSourceMediaRequestSchema)
		.output(z.object({ success: z.boolean() })),
};
