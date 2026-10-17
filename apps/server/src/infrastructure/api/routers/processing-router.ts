import { implement, ORPCError } from "@orpc/server";
import { processingContract } from "@solid-imager/core/domain/contract/processing.contract";
import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import { getProcessingManagementService } from "~/infrastructure/services/processing-management-service";
import { logger } from "~/infrastructure/logger";

const os = implement(processingContract);
async function respond<T>(action: () => Promise<T>): Promise<T> {
	try {
		return await action();
	} catch (error) {
		if (error instanceof ResourceNotFoundError)
			throw new ORPCError("NOT_FOUND", { message: "Local media not found" });
		if (error instanceof ResourceConflictError)
			throw new ORPCError("CONFLICT", { message: error.message });
		logger.error({ err: error }, "Processing management request failed");
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Unable to access media processing state",
		});
	}
}
export const processingRouter = os.router({
	list: os.list.handler(({ input }) =>
		respond(() => getProcessingManagementService().list(input)),
	),
	get: os.get.handler(({ input }) =>
		respond(() => getProcessingManagementService().get(input.mediaId)),
	),
	retry: os.retry.handler(({ input }) =>
		respond(() => getProcessingManagementService().retry(input)),
	),
});
