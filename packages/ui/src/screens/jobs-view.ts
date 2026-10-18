import { z } from "zod";
import type { JobListRequest } from "@solid-imager/core/domain/jobs/schemas";
export type JobFilter = NonNullable<JobListRequest["status"]> | "all";
export const jobsViewSchema = z.enum(["jobs", "processing"]);
export type JobsView = z.infer<typeof jobsViewSchema>;
export const jobsSearchSchema = z.object({
	view: jobsViewSchema.catch("jobs").default("jobs"),
});
