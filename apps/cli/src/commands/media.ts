import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { Cli, z } from "incur";
import { getClient } from "../orpc-client";
import { getErrorMessage, globalOptions } from "../utils";

/**
 * Validates that a string is a valid CSS-like dimension for iTerm2
 */
function validateDimension(d: string): string {
	const dimensionRegex = /^(\d+(%|px|vh|vw)?|auto)$/;
	if (!dimensionRegex.test(d)) {
		throw new Error(`Invalid dimension: ${d}. Must be auto or a number with unit (%, px, vh, vw).`);
	}
	return d;
}

/**
 * Safely resolves a download path to prevent traversal
 */
function resolveDownloadPath(
	output: string | undefined,
	defaultFilename: string,
	agent: boolean = false,
): string {
	const target = output || path.basename(defaultFilename);
	const resolved = path.resolve(target);

	// Security: If used by an AI agent (MCP), restrict to CWD
	if (agent && !resolved.startsWith(process.cwd())) {
		throw new Error(
			`Access denied: Agent is restricted to the current working directory. Path: ${resolved}`,
		);
	}

	return resolved;
}

const MIME_EXTENSION_MAP: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/gif": "gif",
	"image/webp": "webp",
	"video/mp4": "mp4",
	"video/webm": "webm",
	"audio/mpeg": "mp3",
	"audio/wav": "wav",
	"audio/ogg": "ogg",
};

/**
 * Gets the file extension for a mime type
 */
function getExtensionFromMime(mime: string | null): string | null {
	if (!mime) return null;
	const baseMime = mime.split(";")[0].toLowerCase().trim();
	return MIME_EXTENSION_MAP[baseMime] || null;
}

/**
 * Ensures the filename has an appropriate extension based on Content-Type
 */
function ensureExtension(filename: string, contentType: string | null): string {
	if (path.extname(filename)) return filename;
	const ext = getExtensionFromMime(contentType);
	return ext ? `${filename}.${ext}` : filename;
}

export const getHandler = async (c: any) => {
	const rpc = getClient(c.options.remote);
	const sourceId = c.options.source;
	if (!sourceId) {
		return c.error({
			code: "VALIDATION_ERROR",
			message: "--source <sourceId> is required",
		});
	}
	try {
		const media = await rpc.media.get({ sourceId, mediaId: c.args.id });
		return c.ok({ media });
	} catch (e) {
		return c.error({ code: "FETCH_ERROR", message: getErrorMessage(e) });
	}
};

export const searchHandler = async (c: any) => {
	const rpc = getClient(c.options.remote);
	try {
		const result = await rpc.media.search({
			sourceId: c.options.source || null,
			params: {
				limit: c.options.limit,
				offset: c.options.offset,
				// We use a keyword search filter if a query is provided
				condition: c.options.query
					? {
							type: "group",
							operator: "and",
							children: [
								{
									type: "criterion",
									target: "keyword",
									operator: "contains",
									value: c.options.query,
								},
							],
						}
					: undefined,
				sort: "date",
				order: "desc",
			},
		});
		return c.ok({ total: result.total, items: result.media });
	} catch (e) {
		return c.error({ code: "FETCH_ERROR", message: getErrorMessage(e) });
	}
};

export const viewHandler = async (c: any) => {
	try {
		// Fail fast with dimension validation
		const width = validateDimension(c.options.width);
		const height = validateDimension(c.options.height);

		const sourceId = c.options.source;
		if (!sourceId) {
			return c.error({
				code: "VALIDATION_ERROR",
				message: "--source <sourceId> is required",
			});
		}

		const rpc = getClient(c.options.remote);
		const media = await rpc.media.get({ sourceId, mediaId: c.args.id });

		const url = new URL(`/api/sources/${sourceId}/${media.id}`, c.options.remote).toString();
		const res = await fetch(url);
		if (!res.ok) {
			return c.error({
				code: "FETCH_ERROR",
				message: `Failed to fetch image binary: ${res.statusText} (${res.status})`,
			});
		}

		const arrayBuffer = await res.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const base64 = buffer.toString("base64");

		const contentType = res.headers.get("Content-Type");
		const fileName = media.fileName || "image";
		const nameWithExt = ensureExtension(fileName, contentType);
		const name = Buffer.from(nameWithExt).toString("base64");

		const escapeCode = `\x1b]1337;File=name=${name};size=${buffer.length};inline=1;width=${width};height=${height}:${base64}\x07`;

		if (!c.agent) {
			process.stdout.write(`${escapeCode}\n`);
			return c.ok({ displayed: true });
		} else {
			return c.error({
				code: "VIEW_NOT_SUPPORTED",
				message: "Terminal image display is not supported in agent mode.",
			});
		}
	} catch (e) {
		return c.error({ code: "VIEW_ERROR", message: getErrorMessage(e) });
	}
};

export const downloadHandler = async (c: any) => {
	try {
		const sourceId = c.options.source;
		if (!sourceId) {
			return c.error({
				code: "VALIDATION_ERROR",
				message: "--source <sourceId> is required",
			});
		}

		const rpc = getClient(c.options.remote);
		const media = await rpc.media.get({ sourceId, mediaId: c.args.id });

		const url = new URL(`/api/sources/${sourceId}/${media.id}`, c.options.remote).toString();
		const res = await fetch(url);
		if (!res.ok) {
			return c.error({
				code: "FETCH_ERROR",
				message: `Failed to fetch media binary: ${res.statusText} (${res.status})`,
			});
		}

		if (!res.body) {
			return c.error({
				code: "FETCH_ERROR",
				message: "Response body is empty",
			});
		}

		const contentType = res.headers.get("Content-Type");
		const defaultFilename = ensureExtension(media.fileName || media.id, contentType);
		const filename = resolveDownloadPath(c.options.output, defaultFilename, c.agent);
		const fileStream = createWriteStream(filename);

		// Bun or Node native fetch bodies are ReadableStreams
		await finished(Readable.fromWeb(res.body as any).pipe(fileStream));

		return c.ok({ message: `Downloaded to ${filename}` });
	} catch (e) {
		return c.error({ code: "DOWNLOAD_ERROR", message: getErrorMessage(e) });
	}
};

export const mediaCmd = Cli.create("media", { description: "Media operations" })
	.command("get", {
		description: "Get media metadata by ID",
		args: z.object({ id: z.string() }),
		options: globalOptions,
		run: getHandler,
	})
	.command("search", {
		description: "Search media",
		options: globalOptions.extend({
			query: z.string().optional().describe("Search query text"),
			limit: z.coerce.number().default(20).describe("Max results"),
			offset: z.coerce.number().default(0).describe("Pagination offset"),
		}),
		run: searchHandler,
	})
	.command("view", {
		description: "View an image directly in the terminal (Requires iTerm2/Kitty/WezTerm)",
		args: z.object({ id: z.string() }),
		options: globalOptions.extend({
			width: z.string().default("auto").describe("Width (e.g. 50%, 400px)"),
			height: z.string().default("auto").describe("Height (e.g. auto, 400px)"),
		}),
		run: viewHandler,
	})
	.command("download", {
		description: "Download media file by ID",
		args: z.object({ id: z.string() }),
		options: globalOptions.extend({
			output: z.string().optional().describe("Output file path (optional)"),
		}),
		run: downloadHandler,
	});
