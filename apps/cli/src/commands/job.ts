import { Cli, z } from "incur";
import { globalOptions } from "../utils.ts";

// The server exposes jobs through the shared API contract. The CLI commands
// remain placeholders until the CLI client wiring is added.

export const jobCmd = Cli.create("job", {
	description: "Background job management",
})
	.command("list", {
		description: "List active or recent jobs",
		options: globalOptions.extend({
			limit: z.coerce.number().default(20),
			offset: z.coerce.number().default(0),
			status: z
				.enum(["pending", "processing", "completed", "failed", "cancelled"])
				.optional()
				.describe("Filter by status"),
			type: z.string().optional().describe("Filter by job type"),
		}),
		async run(c) {
			return c.error({
				code: "NOT_IMPLEMENTED",
				message: "Job API is not wired into the CLI yet.",
			});
		},
	})
	.command("retry", {
		description: "Retry a failed job",
		args: z.object({ id: z.string() }),
		options: globalOptions,
		async run(c) {
			return c.error({
				code: "NOT_IMPLEMENTED",
				message: "Job retry API is not wired into the CLI yet.",
			});
		},
	})
	.command("clear", {
		description: "Clear completed or failed jobs from history",
		options: globalOptions.extend({
			status: z.enum(["completed", "failed"]).default("completed"),
		}),
		async run(c) {
			return c.error({
				code: "NOT_IMPLEMENTED",
				message: "Job clear API is not wired into the CLI yet.",
			});
		},
	});
