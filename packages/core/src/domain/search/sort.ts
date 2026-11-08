import { z } from "zod";

/** Sort keys supported by media collections and saved search presets. */
export const mediaSortSchema = z.enum([
	"date",
	"modifiedAt",
	"indexedAt",
	"name",
	"size",
	"resolution",
	"rating",
	"viewCount",
]);
export type MediaSort = z.infer<typeof mediaSortSchema>;
