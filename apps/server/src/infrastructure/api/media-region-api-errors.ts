import { ORPCError } from "@orpc/server";
import {
	ResourceConflictError,
	ResourceNotFoundError,
	ValidationError,
} from "@solid-imager/core/domain/errors";
import { z } from "zod";

export function toMediaRegionOrpcError(error: unknown): never {
	if (error instanceof ResourceNotFoundError) {
		throw new ORPCError("NOT_FOUND", { message: error.message });
	}
	if (error instanceof ResourceConflictError) {
		throw new ORPCError("CONFLICT", { message: error.message });
	}
	if (error instanceof ValidationError || error instanceof z.ZodError) {
		throw new ORPCError("BAD_REQUEST", {
			message: error instanceof Error ? error.message : "Invalid media region",
		});
	}
	throw error;
}
