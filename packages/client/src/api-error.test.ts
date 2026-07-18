import { describe, expect, it } from "vitest";
import { APIError, isTransientApiError } from "./api-error";

describe("isTransientApiError", () => {
	it("retries network and timeout API errors", () => {
		expect(isTransientApiError(new APIError("network", "NETWORK_ERROR"))).toBe(
			true,
		);
		expect(isTransientApiError(new APIError("timeout", "TIMEOUT"))).toBe(true);
	});

	it("does not retry non-transient API errors", () => {
		expect(isTransientApiError(new APIError("server", "SERVER_ERROR"))).toBe(
			false,
		);
		expect(isTransientApiError(new APIError("cors", "CORS_ERROR"))).toBe(false);
		expect(isTransientApiError(new APIError("unknown", "UNKNOWN"))).toBe(false);
	});

	it("only retries generic fetch TypeErrors", () => {
		expect(isTransientApiError(new TypeError("Failed to fetch"))).toBe(true);
		expect(isTransientApiError(new Error("invalid input"))).toBe(false);
		expect(isTransientApiError(new DOMException("aborted", "AbortError"))).toBe(
			false,
		);
	});
});
