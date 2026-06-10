/**
 * Safely extract error message from unknown error object.
 * Replaces unsafe `(error as Error).message` patterns.
 */
export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return String(error);
}
