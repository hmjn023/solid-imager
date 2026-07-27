import { eventIterator, oc } from "@orpc/contract";
import { z } from "zod";
import { safeJobSchema } from "../jobs/schemas";
import { jobEventSchema } from "../sources/events";

export const jobsContract = {
	get: oc
		.input(z.object({ id: z.string().uuid() }))
		.output(safeJobSchema.nullable()),
	events: oc.output(eventIterator(jobEventSchema)),
};
