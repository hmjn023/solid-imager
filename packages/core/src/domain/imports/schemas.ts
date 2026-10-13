import { z } from "zod";
import { downloadItemSchema } from "../media/schemas";

export const importRequestStatusSchema = z.enum([
	"pending",
	"approved",
	"cancelled",
	"blocked",
	"superseded",
]);
export type ImportRequestStatus = z.infer<typeof importRequestStatusSchema>;
export const importBlockedReasonSchema = z.enum([
	"invalid_item",
	"legacy_failure",
	"legacy_reservation",
]);
export const importAuthoritySchema = z.enum(["legacy", "dedicated"]);
export type ImportBlockedReason = z.infer<typeof importBlockedReasonSchema>;
export type ImportAuthority = z.infer<typeof importAuthoritySchema>;
export const importItemSchema = downloadItemSchema.extend({
	targetUrl: z.url(),
});
export const importRequestSchema = z.object({
	id: z.uuid(),
	item: importItemSchema.nullable(),
	requestKey: z.string(),
	status: importRequestStatusSchema,
	canonicalId: z.uuid().nullable(),
	blockedReason: importBlockedReasonSchema.nullable(),
	targetSourceId: z.uuid().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	approvedAt: z.coerce.date().nullable(),
	cancelledAt: z.coerce.date().nullable(),
});
export type ImportRequest = z.infer<typeof importRequestSchema>;
/** Review content only. Browser authentication material stays on the server. */
export const safePendingImportRequestSchema = z.object({
	id: z.uuid(),
	item: importItemSchema.omit({ cookies: true, userAgent: true }),
	createdAt: z.coerce.date(),
});
export type SafePendingImportRequest = z.infer<
	typeof safePendingImportRequestSchema
>;
export const importCutoverReportSchema = z.object({
	migrated: z.number().int().nonnegative(),
	blocked: z.number().int().nonnegative(),
	aliases: z.number().int().nonnegative(),
});
export type ImportCutoverReport = z.infer<typeof importCutoverReportSchema>;
export const importBulkAddResultSchema = z.object({
	addedCount: z.number().int().nonnegative(),
	skippedCount: z.number().int().nonnegative(),
	restoredCount: z.number().int().nonnegative(),
});
