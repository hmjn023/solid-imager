import { Cli, z } from "incur";
import { getClient } from "../orpc-client";
import { getErrorMessage, globalOptions } from "../utils";

export const pullHandler = async (c: any) => {
	const rpc = getClient(c.options.remote);
	const localSourceId = c.options.source;
	const remoteUrl = c.options.targetRemote;
	const remoteSourceId = c.options.targetSource;

	if (!localSourceId || !remoteUrl || !remoteSourceId) {
		return c.error({
			code: "VALIDATION_ERROR",
			message:
				"--source, --target-remote, and --target-source are all required",
		});
	}

	try {
		console.log(
			`Pulling from ${remoteUrl} (Source: ${remoteSourceId}) to local source ${localSourceId}...`,
		);
		const result = await rpc.sync.pull({
			localSourceId,
			remoteUrl,
			remoteSourceId,
		});
		return c.ok(result);
	} catch (e) {
		return c.error({ code: "SYNC_ERROR", message: getErrorMessage(e) });
	}
};

export const pushHandler = async (c: any) => {
	const rpc = getClient(c.options.remote);
	const localSourceId = c.options.source;
	const remoteUrl = c.options.targetRemote;
	const remoteSourceId = c.options.targetSource;

	if (!localSourceId || !remoteUrl || !remoteSourceId) {
		return c.error({
			code: "VALIDATION_ERROR",
			message:
				"--source, --target-remote, and --target-source are all required",
		});
	}

	try {
		console.log(
			`Pushing from local source ${localSourceId} to ${remoteUrl} (Source: ${remoteSourceId})...`,
		);
		const result = await rpc.sync.push({
			localSourceId,
			remoteUrl,
			remoteSourceId,
		});
		return c.ok(result);
	} catch (e) {
		return c.error({ code: "SYNC_ERROR", message: getErrorMessage(e) });
	}
};

export const syncCmd = Cli.create("sync", {
	description: "Synchronization operations",
})
	.command("pull", {
		description: "Pull media and metadata from a remote server",
		options: globalOptions.extend({
			targetRemote: z.string().describe("Remote server URL to pull from"),
			targetSource: z.string().describe("Remote source ID (UUID)"),
		}),
		run: pullHandler,
	})
	.command("push", {
		description: "Push media and metadata to a remote server",
		options: globalOptions.extend({
			targetRemote: z.string().describe("Remote server URL to push to"),
			targetSource: z.string().describe("Remote source ID (UUID)"),
		}),
		run: pushHandler,
	});
