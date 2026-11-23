import { Cli, z } from "incur";
import { getClient } from "../orpc-client.ts";
import { getErrorMessage, globalOptions } from "../utils.ts";

import type { BasicContext } from "./media.ts";

const tagArgs = z.object({ mediaId: z.string() });
const tagOptions = globalOptions.extend({
	mediaSourceId: z
		.string()
		.describe("The source ID of the media (required by API)"),
});

export const tagHandler = async (
	c: BasicContext<z.infer<typeof tagArgs>, z.infer<typeof tagOptions>>,
) => {
	const rpc = getClient(c.options.remote);
	try {
		const result = await rpc.ai.tag({
			mediaId: c.args.mediaId,
			mediaSourceId: c.options.mediaSourceId,
		});
		return c.ok({ result });
	} catch (e) {
		return c.error({ code: "AI_ERROR", message: getErrorMessage(e) });
	}
};

export const statusHandler = async (
	c: BasicContext<Record<string, never>, z.infer<typeof globalOptions>>,
) => {
	try {
		const details = await getClient(c.options.remote)
			.ai.health()
			.catch(() => null);
		if (details?.status === "available") {
			return c.ok({ status: "online", details });
		}
		return c.error({
			code: "OFFLINE",
			message: details?.message ?? "AI service appears offline or unreachable.",
		});
	} catch (e) {
		return c.error({ code: "FETCH_ERROR", message: getErrorMessage(e) });
	}
};

export const aiCmd = Cli.create("ai", { description: "AI processing tools" })
	.command("tag", {
		description: "Trigger AI tagging for a remote media file",
		args: tagArgs,
		options: tagOptions,
		run: tagHandler,
	})
	.command("status", {
		description: "Check AI service health",
		options: globalOptions,
		run: statusHandler,
	});
