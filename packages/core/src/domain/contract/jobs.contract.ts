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
		.meta({
			openapi: {
				tags: ["Jobs"],
				summary: "Download job artifact",
				description: "Stream a completed job artifact",
			},
		})
		.input(jobIdRequestSchema)
		.output(z.instanceof(ReadableStream)),
	retry: oc.input(jobIdRequestSchema).output(jobDtoSchema),
	cancel: oc.input(jobIdRequestSchema).output(jobDtoSchema),
	events: oc.output(eventIterator(jobEventSchema)),
};
