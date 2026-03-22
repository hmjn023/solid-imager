import { os } from "@orpc/server";
import { z } from "zod";

/**
 * Utils Router Implementation
 * Handles utility-like functions: fetchUrl, AI tagging, etc.
 */
export const utilsRouter = {
	/**
	 * Fetches content from an external URL (Proxy)
	 */
	fetchUrl: os
		.input(z.object({ url: z.string().url() }))
		.handler(async ({ input }) => {
			const response = await fetch(input.url);
			if (!response.ok) {
				throw new Error(`Failed to fetch URL: ${response.statusText}`);
			}
			return await response.blob();
		}),
};
