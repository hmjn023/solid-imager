import { z } from "zod";

export const mediaRegionKindSchema = z.enum(["full", "person", "manual"]);
export type MediaRegionKind = z.infer<typeof mediaRegionKindSchema>;

export const mediaRevisionSchema = z
	.string()
	.regex(/^[0-9a-f]{64}$/, "Revision must be a lowercase SHA-256 digest");

export const mediaRegionBoundingBoxSchema = z
	.object({
		x: z.number().min(0).max(1),
		y: z.number().min(0).max(1),
		width: z.number().positive().max(1),
		height: z.number().positive().max(1),
	})
	.refine((bbox) => bbox.x + bbox.width <= 1, {
		message: "Region must fit within the source width",
		path: ["width"],
	})
	.refine((bbox) => bbox.y + bbox.height <= 1, {
		message: "Region must fit within the source height",
		path: ["height"],
	});

export type MediaRegionBoundingBox = z.infer<
	typeof mediaRegionBoundingBoxSchema
>;

export const mediaRegionSchema = z.object({
	id: z.string().uuid(),
	mediaId: z.string().uuid(),
	kind: mediaRegionKindSchema,
	x: z.number().nullable(),
	y: z.number().nullable(),
	width: z.number().nullable(),
	height: z.number().nullable(),
	sourceWidth: z.number().int().positive(),
	sourceHeight: z.number().int().positive(),
	sourceModifiedAt: z.coerce.date(),
	sourceRevision: mediaRevisionSchema,
	regionRevision: mediaRevisionSchema,
	label: z.string().nullable(),
	manualReason: z.string().nullable(),
	detectionKey: z.string().nullable(),
	detector: z.string().nullable(),
	detectorModel: z.string().nullable(),
	detectorVersion: z.string().nullable(),
	score: z.number().min(0).max(1).nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type MediaRegion = z.infer<typeof mediaRegionSchema>;

/** Fields that are safe to expose to clients. Internal idempotency keys stay private. */
export const safeMediaRegionSchema = mediaRegionSchema
	.omit({ detectionKey: true })
	.extend({ stale: z.boolean() });

export type SafeMediaRegion = z.infer<typeof safeMediaRegionSchema>;

export const createManualMediaRegionSchema = z.object({
	mediaId: z.string().uuid(),
	bbox: mediaRegionBoundingBoxSchema,
	label: z.string().trim().min(1).max(200).nullable().optional(),
	manualReason: z.string().trim().max(500).nullable().optional(),
});

export type CreateManualMediaRegion = z.infer<
	typeof createManualMediaRegionSchema
>;

export const updateMediaRegionSchema = z.object({
	regionId: z.string().uuid(),
	expectedRevision: mediaRevisionSchema,
	bbox: mediaRegionBoundingBoxSchema.optional(),
	label: z.string().trim().min(1).max(200).nullable().optional(),
	manualReason: z.string().trim().max(500).nullable().optional(),
});

export type UpdateMediaRegion = z.infer<typeof updateMediaRegionSchema>;

export const deleteMediaRegionSchema = z.object({
	regionId: z.string().uuid(),
	expectedRevision: mediaRevisionSchema,
});

export const mediaRegionRenderProfileSchema = z.object({
	transparent: z.boolean().default(false),
});

export type MediaRegionRenderProfile = z.infer<
	typeof mediaRegionRenderProfileSchema
>;

export const materializeMediaRegionSchema = z.object({
	regionId: z.string().uuid(),
	expectedRevision: mediaRevisionSchema,
	profile: mediaRegionRenderProfileSchema,
});

export const materializedMediaRegionSchema = z.object({
	regionId: z.string().uuid(),
	mediaId: z.string().uuid(),
	fileName: z.string(),
	alreadyExisted: z.boolean(),
});

export type MaterializedMediaRegion = z.infer<
	typeof materializedMediaRegionSchema
>;

export const detectedRegionInputSchema = z.object({
	bbox: z.object({
		x1: z.number(),
		y1: z.number(),
		x2: z.number(),
		y2: z.number(),
	}),
	label: z.string(),
	score: z.number().min(0).max(1),
});

export type DetectedRegionInput = z.infer<typeof detectedRegionInputSchema>;

export const mediaRegionRelationSnapshotSchema = z.object({
	regionId: z.string().uuid(),
	regionRevision: mediaRevisionSchema,
	sourceRevision: mediaRevisionSchema,
	bbox: mediaRegionBoundingBoxSchema,
	label: z.string().nullable(),
	profile: mediaRegionRenderProfileSchema,
	profileVersion: z.string().min(1),
	rendererVersion: z.string().min(1),
});

export type MediaRegionRelationSnapshot = z.infer<
	typeof mediaRegionRelationSnapshotSchema
>;
