import { ORPCError } from "@orpc/server";
import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import { dismissJobHistory } from "~/infrastructure/repositories/job-history-repository";
import { batchRunService } from "./batch-run-service";
import { downloadRunService } from "./download-run-service";
import { sourceRunService } from "./source-run-service";

export async function deleteJobHistory(id: string) {
	await downloadRunService.initialize();
	await batchRunService.initialize();
	await sourceRunService.initialize();
	try {
		await dismissJobHistory(id);
		return { success: true as const };
	} catch (error) {
		if (error instanceof ResourceConflictError)
			throw new ORPCError("BAD_REQUEST", { message: error.message });
		if (error instanceof ResourceNotFoundError)
			throw new ORPCError("NOT_FOUND", { message: "Job not found" });
		throw error;
	}
}
