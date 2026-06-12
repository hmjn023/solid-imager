import { z } from "incur";
import { getErrorMessage } from "@solid-imager/core/utils";

export { getErrorMessage };

/**
 * Shared global options for commands
 */
export const globalOptions = z.object({
	remote: z
		.string()
		.default("http://localhost:3000")
		.describe("Remote server URL"),
	source: z.string().uuid().optional().describe("Media source ID (UUID)"),
});
