import { z } from "zod";
export const jobsViewSchema = z.enum(["jobs", "processing"]);
export type JobsView = z.infer<typeof jobsViewSchema>;
export const jobsSearchSchema = z.object({
	view: jobsViewSchema.catch("jobs").default("jobs"),
});
