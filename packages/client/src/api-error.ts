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
