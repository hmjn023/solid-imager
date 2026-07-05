import { describe, expect, it } from "vitest";
import { APIError, isTransientApiError } from "./api-error";

describe("isTransientApiError", () => {
	it("retries network and timeout API errors", () => {
		expect(isTransientApiError(new APIError("network", "NETWORK_ERROR"))).toBe(
			true,
		);
		expect(isTransientApiError(new APIError("timeout", "TIMEOUT"))).toBe(true);
	});

	it("does not retry server and validation-like errors", () => {
		expect(isTransientApiError(new APIError("server", "SERVER_ERROR"))).toBe(
			false,
		);
		expect(isTransientApiError(new Error("invalid input"))).toBe(false);
	});
});
