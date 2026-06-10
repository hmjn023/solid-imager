#!/usr/bin/env bun
import { Cli } from "incur";
import { aiCmd } from "./commands/ai.ts";
import { dbCmd } from "./commands/db.ts";
import { jobCmd } from "./commands/job.ts";
import { mediaCmd } from "./commands/media.ts";
import { getClient } from "./orpc-client.ts";
import { globalOptions } from "./utils.ts";

const cli = Cli.create("imager-cli", {
	description: "Solid Imager Management CLI",
});

cli.command("ping", {
	description: "Ping the remote server",
	options: globalOptions,
	async run(c) {
		try {
			const rpc = getClient(c.options.remote);
			const config = await rpc.config.get();
			return { status: "ok", remote: c.options.remote, config };
		} catch (e: unknown) {
			return {
				error: "CONNECTION_ERROR",
				message: `Failed to connect to ${c.options.remote}: ${e instanceof Error ? e.message : String(e)}`,
			};
		}
	},
});

cli.command(mediaCmd);
cli.command(jobCmd);
cli.command(aiCmd);
cli.command(dbCmd);

cli.serve();
