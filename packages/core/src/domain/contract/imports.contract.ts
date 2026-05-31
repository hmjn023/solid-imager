import { oc } from "@orpc/contract";
import { z } from "zod";
import { downloadItemSchema } from "../media/schemas";

export const importsContract = {
	bulkAdd: oc
		.input(z.object({ items: z.array(downloadItemSchema) })),

	listPending: oc,

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
};
