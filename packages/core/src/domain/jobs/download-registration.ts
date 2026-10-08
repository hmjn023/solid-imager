import { z } from "zod";
import { mediaMetadataContextSchema } from "../media/schemas";

/** Durable handoff from completed download files to media registration. */
export const downloadRegistrationEntrySchema = z.object({
	stagedPath: z.string().min(1),
	filePath: z.string().min(1),
	fileSize: z.number().int().nonnegative(),
	modifiedAt: z.coerce.date(),
	published: z.boolean().default(false),
	context: mediaMetadataContextSchema.extend({
		sourceUrls: z.array(z.url()).min(1),
	}),
});
export const downloadRegistrationCheckpointSchema = z.object({
	version: z.literal(1),
	mediaSourceId: z.string().min(1),
	sourcePath: z.string().min(1),
	stagingDirectory: z.string().min(1),
	entries: z.array(downloadRegistrationEntrySchema).min(1),
});
export type DownloadRegistrationEntry = z.infer<
	typeof downloadRegistrationEntrySchema
>;
