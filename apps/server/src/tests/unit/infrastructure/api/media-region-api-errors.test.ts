import { ORPCError } from "@orpc/server";
import { StaleMediaRegionError } from "@solid-imager/core/domain/errors";
import { describe, expect, it } from "vite-plus/test";
import { toMediaRegionOrpcError } from "~/infrastructure/api/media-region-api-errors";

describe("toMediaRegionOrpcError", () => {
	it("maps stale materialization conflicts to oRPC CONFLICT (HTTP 409)", () => {
		try {
			toMediaRegionOrpcError(
				new StaleMediaRegionError("10000000-0000-4000-8000-000000000001"),
			);
		} catch (error) {
			expect(error).toBeInstanceOf(ORPCError);
			if (error instanceof ORPCError) {
				expect(error.code).toBe("CONFLICT");
			}
			return;
		}
		throw new Error("Expected a conflict error.");
	});
});
