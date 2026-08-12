import { eventIterator, oc } from "@orpc/contract";
import { z } from "zod";
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
	downloadArtifact: oc
		.input(jobIdRequestSchema)
		.output(z.file().mime("application/octet-stream")),
	retry: oc.input(jobIdRequestSchema).output(jobDtoSchema),
	cancel: oc.input(jobIdRequestSchema).output(jobDtoSchema),
	events: oc.output(eventIterator(jobEventSchema)),
};
