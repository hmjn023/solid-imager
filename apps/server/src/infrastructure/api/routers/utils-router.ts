import { implement } from "@orpc/server";
import { utilsContract } from "@solid-imager/core/domain/contract/utils.contract";

/**
 * Utils Router Implementation
 * Handles utility-like functions: fetchUrl, AI tagging, etc.
 */
const os = implement(utilsContract);

export const utilsRouter = os.router({
	/**
	 * Fetches content from an external URL (Proxy)
	 */
	fetchUrl: os.fetchUrl.handler(async ({ input }) => {
		const response = await fetch(input.url);
		if (!response.ok) {
			throw new Error(`Failed to fetch URL: ${response.statusText}`);
		}
		return await response.blob();
	}),
});
