import { eventIterator, oc } from "@orpc/contract";
import { z } from "zod";
import { jobDtoSchema } from "../jobs/schemas";
import { sourceEventSchema } from "../sources/events";
import {
	mediaSourceInfoSchema,
	mediaSourceStatusSchema,
	safeMediaSourceSchema,
} from "../sources/schemas";

const importResultSchema = z.object({
	success: z.boolean(),
	importedCount: z.number(),
	skippedCount: z.number(),
	errors: z.array(z.string()),
	message: z.string(),
});

const importNdjsonResultSchema = z.object({
	importedCount: z.number(),
	skippedCount: z.number(),
	errors: z.array(z.string()),
});

const sourceSyncResultSchema = z.discriminatedUnion("success", [
	z.object({
		id: z.string().uuid(),
		success: z.literal(true),
		sourceId: z.string().uuid(),
		added: z.number().int().nonnegative(),
		deleted: z.number().int().nonnegative(),
	}),
	z.object({
		id: z.string().uuid(),
		success: z.literal(false),
		error: z.string(),
	}),
]);

export type SourceSyncResult = z.infer<typeof sourceSyncResultSchema>;

export const sourcesContract = {
	list: oc
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "List all media sources",
				description:
					"Retrieve a list of all registered media sources with sensitive information removed",
			},
		})
		.output(z.array(safeMediaSourceSchema)),

	get: oc
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Get media source by ID",
				description: "Retrieve a specific media source by its UUID",
			},
		})
		.input(z.object({ id: z.string().uuid() }))
		.output(safeMediaSourceSchema),

	create: oc
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Create a new media source",
				description: "Register a new media source (local, SFTP, S3, etc.)",
			},
		})
		.input(mediaSourceInfoSchema)
		.output(safeMediaSourceSchema),

	update: oc
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Update media source",
				description: "Update an existing media source's configuration",
			},
		})
		.input(
			z.object({
				id: z.string().uuid(),
				data: mediaSourceInfoSchema.partial(),
			}),
		)
		.output(safeMediaSourceSchema),

	delete: oc
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Delete media source",
				description: "Remove a media source and stop its file monitoring",
			},
		})
		.input(z.object({ id: z.string().uuid() }))
		.output(z.object({ success: z.boolean() })),

	sync: oc
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Sync media sources",
				description: "Synchronize local media source directory with database",
			},
		})
		.input(z.object({ ids: z.array(z.string().uuid()) }))
		.output(
			z.object({
				results: z.array(sourceSyncResultSchema),
			}),
		),

	dump: oc
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Export media source",
				description:
					"Export media source data as NDJSON or uncompressed TAR archive",
			},
		})
		.input(
			z.object({
				id: z.string().uuid(),
				mode: z.enum(["json", "zip"]).default("json"),
				includeImages: z.boolean().optional().default(false),
			}),
		),

	enqueueExport: oc
		.input(
			z.object({
				id: z.string().uuid(),
				mode: z.enum(["json", "zip"]).default("json"),
				includeImages: z.boolean().default(false),
			}),
		)
		.output(jobDtoSchema),

	restore: oc
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Restore media source",
				description:
					"Restore media source from exported JSON data (legacy array)",
			},
		})
		.input(
			z.object({
				id: z.string().uuid(),
				data: z.array(z.any()),
			}),
		)
		.output(
			z.object({
				processed: z.number(),
				skipped: z.number(),
				errors: z.array(z.string()),
				cancelled: z.boolean().optional(),
			}),
		),

	importZip: oc
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Import media source from TAR",
				description: "Import media source data from a TAR archive",
			},
		})
		.input(
			z.object({
				id: z.string().uuid(),
				file: z.instanceof(File),
			}),
		)
		.output(importResultSchema),

	importNdjson: oc
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Import media source from NDJSON file",
				description: "Import media source metadata from an NDJSON file",
			},
		})
		.input(
			z.object({
				id: z.string().uuid(),
				file: z.instanceof(File),
			}),
		)
		.output(importNdjsonResultSchema),

	enqueueImport: oc
		.input(
			z.object({
				id: z.string().uuid(),
				mode: z.enum(["json", "zip"]),
				file: z.instanceof(File),
			}),
		)
		.output(jobDtoSchema),

	status: oc
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Get media source status",
				description: "Retrieve current status and statistics of a media source",
			},
		})
		.input(z.object({ id: z.string().uuid() }))
		.output(mediaSourceStatusSchema),

	events: oc
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Subscribe to media source events",
				description:
					"Real-time Server-Sent Events stream for media source updates",
			},
		})
		.input(z.object({ id: z.string().uuid().or(z.literal("*")) }))
		.output(eventIterator(sourceEventSchema)),
};
