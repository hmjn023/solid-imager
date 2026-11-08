import { z } from "zod";
import { searchGroupSchema } from "../search/criteria";
import { mediaSortSchema } from "../search/sort";

// Preset schemas
/** Saved search condition and optional mode and ordering settings. */
export const presetSchema = z.object({
	id: z.number().int(),
	name: z.string().min(1, "Name is required"),
	// Note: searchGroupSchema is lazy, so we use it directly.
	// The database stores JSONB, so we validate it against the structure.
	value: searchGroupSchema,
	sort: mediaSortSchema.optional(),
	order: z.enum(["asc", "desc"]).optional(),
	mode: z.enum(["simple", "pro"]).optional(),
	createdAt: z.coerce.date(),
});

export type Preset = z.infer<typeof presetSchema>;

export const createPresetRequestSchema = z.object({
	name: z.string().min(1, "Name is required"),
	value: searchGroupSchema,
	sort: mediaSortSchema.optional(),
	order: z.enum(["asc", "desc"]).optional(),
	mode: z.enum(["simple", "pro"]).optional(),
});

export type CreatePresetRequest = z.infer<typeof createPresetRequestSchema>;

export const updatePresetRequestSchema = z.object({
	name: z.string().min(1, "Name is required").optional(),
	value: searchGroupSchema.optional(),
	sort: mediaSortSchema.optional(),
	order: z.enum(["asc", "desc"]).optional(),
	mode: z.enum(["simple", "pro"]).optional(),
});

export type UpdatePresetRequest = z.infer<typeof updatePresetRequestSchema>;
