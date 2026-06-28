import { eventIterator, oc } from "@orpc/contract";
import { z } from "zod";
import { downloadItemSchema, pendingImportJobSchema } from "../media/schemas";
import { importEventSchema } from "../sources/events";

export const importsContract = {
	bulkAdd: oc.input(z.object({ items: z.array(downloadItemSchema) })),

	listPending: oc.output(z.array(pendingImportJobSchema)),

	process: oc
		.input(
			z.object({
				jobIds: z.array(z.string().uuid()),
				targetSourceId: z.string().uuid(),
			}),
		)
		.output(z.object({ success: z.boolean(), processedCount: z.number() })),

	cancel: oc
		.input(z.object({ jobIds: z.array(z.string().uuid()) }))
		.output(z.object({ success: z.boolean() })),

	events: oc.output(eventIterator(importEventSchema)),
};
