import { eventIterator, oc } from "@orpc/contract";
import {
	jobDtoSchema,
	jobIdRequestSchema,
	jobListRequestSchema,
	jobListResponseSchema,
} from "../jobs/schemas";
import { jobEventSchema } from "../sources/events";

export const jobsContract = {
	list: oc.input(jobListRequestSchema).output(jobListResponseSchema),
	get: oc.input(jobIdRequestSchema).output(jobDtoSchema),
	retry: oc.input(jobIdRequestSchema).output(jobDtoSchema),
	cancel: oc.input(jobIdRequestSchema).output(jobDtoSchema),
	events: oc.output(eventIterator(jobEventSchema)),
};
