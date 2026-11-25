import { getErrorMessage } from "@solid-imager/core/utils";
import { z } from "incur";

export { getErrorMessage };

/** Resolves a CLI server option, allowing hosts with the HTTP scheme omitted. */
export function getServerBaseUrl(url: string): string {
	const base = url || "http://localhost:3000";
	return /^https?:\/\//i.test(base) ? base : `http://${base}`;
}

/**
 * Shared global options for commands
 */
export const globalOptions = z.object({
	remote: z
		.string()
		.default("http://localhost:3000")
		.describe("Remote server URL"),
	source: z.uuid().optional().describe("Media source ID (UUID)"),
});
