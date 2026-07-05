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

export function isTransientApiError(error: unknown): boolean {
	if (error instanceof APIError) {
		return error.code === "NETWORK_ERROR" || error.code === "TIMEOUT";
	}
	if (!(error instanceof Error)) {
		return false;
	}
	const message = error.message.toLowerCase();
	return (
		message.includes("network") ||
		message.includes("timeout") ||
		message.includes("failed to fetch")
	);
}
