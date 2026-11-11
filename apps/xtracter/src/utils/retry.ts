import { APIError } from "../api";

/** Retry transient transport errors without re-reading the operation's settings. */
export async function retryWithBackoff<T>(
	fn: () => Promise<T>,
	maxRetries = 3,
	initialDelay = 1000,
): Promise<T> {
	for (let attempt = 0; ; attempt++) {
		try {
			return await fn();
		} catch (error) {
			if (
				!(error instanceof APIError) ||
				(error.code !== "TIMEOUT" && error.code !== "NETWORK_ERROR") ||
				attempt >= maxRetries - 1
			) {
				throw error;
			}
			await new Promise((resolve) =>
				setTimeout(resolve, initialDelay * 2 ** attempt),
			);
		}
	}
}
