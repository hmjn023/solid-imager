import { APIError } from "@solid-imager/client";

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
