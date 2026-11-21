import { z } from "zod";
import type { Job } from "../repositories/job-repository";

export const importBatchContextSchema = z.object({
	importBatchId: z.uuid(),
	importTargetId: z.uuid(),
});
export type ImportBatchContext = z.infer<typeof importBatchContextSchema>;

export function readImportBatch(job: Pick<Job, "payload" | "parentId">) {
	if (!job.parentId) return undefined;
	let payload = job.payload;
	if (typeof payload === "string") {
		try {
			payload = JSON.parse(payload);
		} catch {
			return undefined;
		}
	}
	const parsed = importBatchContextSchema.safeParse(payload);
	return parsed.success && parsed.data.importTargetId === job.parentId
		? parsed.data
		: undefined;
}

export const importAiStages = [
	["auto_tagging"],
	["extract_embedding_vector", "extract_embedding_batch"],
	["extract_ccip_vector"],
] as const;

export type ImportWorkOwner = ImportBatchContext & {
	workId: string;
	attempt: number;
};

export function importWorkOwner(job: Job): ImportWorkOwner | undefined {
	const context = readImportBatch(job);
	return context
		? { ...context, workId: job.id, attempt: job.attemptCount ?? 0 }
		: undefined;
}
