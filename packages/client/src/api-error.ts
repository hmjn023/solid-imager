/** Client-side transport failure, with the original error retained when available. */
export class APIError extends Error {
	readonly code:
		| "NETWORK_ERROR"
		| "TIMEOUT"
		| "CORS_ERROR"
		| "SERVER_ERROR"
		| "UNKNOWN";
	readonly originalError?: unknown;

	constructor(
		message: string,
		code:
			| "NETWORK_ERROR"
			| "TIMEOUT"
			| "CORS_ERROR"
			| "SERVER_ERROR"
			| "UNKNOWN",
		originalError?: unknown,
	) {
		super(message);
		this.name = "APIError";
		this.code = code;
		this.originalError = originalError;
	}
}

/** Identify network failures and timeouts that may succeed on retry. */
export function isTransientApiError(error: unknown): boolean {
	if (error instanceof APIError) {
		return error.code === "NETWORK_ERROR" || error.code === "TIMEOUT";
	}
	return error instanceof TypeError;
}
