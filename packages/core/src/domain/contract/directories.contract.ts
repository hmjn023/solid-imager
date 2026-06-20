import { oc } from "@orpc/contract";
import { z } from "zod";

export const directoriesContract = {
	list: oc.input(
		z.object({
			sourceId: z.string().uuid(),
			path: z.string().default(""),
		}),
	),

	create: oc.input(
		z.object({
			sourceId: z.string().uuid(),
			path: z.string(),
			name: z.string(),
		}),
	),

	delete: oc.input(
		z.object({
			sourceId: z.string().uuid(),
			path: z.string(),
			force: z.boolean().optional(),
		}),
	),

	rename: oc.input(
		z.object({
			sourceId: z.string().uuid(),
			oldPath: z.string(),
			newPath: z.string(),
		}),
	),
};
