import { eventIterator, oc } from "@orpc/contract";
import { jobEventSchema } from "../sources/events";

export const jobsContract = {
	events: oc.output(eventIterator(jobEventSchema)),
};
