import { appendFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { createClient } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/contract";
import { logger } from "../src/infrastructure/logger";
import {
	downloadsFromLike,
	likeEventSchema,
	readLines,
} from "./x-activity/payload";
import { XOAuth } from "./x-activity/oauth";

const HELP = `X likes → Solid Imager (run from apps/server)

bun --env-file=.env.x-activity.local scripts/x-activity.ts auth
bun --env-file=.env.x-activity.local scripts/x-activity.ts sources
bun --env-file=.env.x-activity.local scripts/x-activity.ts listen [--capture]
bun --env-file=.env.x-activity.local scripts/x-activity.ts replay <events.ndjson> [--capture]

Set X_CLIENT_ID for auth/listen and IMAGER_SOURCE_ID for importing.
See scripts/x-activity/README.md for setup and payload inspection.
`;

const subscriptionSchema = z.object({
	subscription_id: z.string(),
	event_type: z.string(),
	tag: z.string().optional(),
	webhook_id: z.string().nullish(),
	expires_at: z.string().nullish(),
	filter: z.object({
		user_id: z.string().optional(),
		keyword: z.string().optional(),
		direction: z.string().optional(),
		qualifiers: z.record(z.string(), z.string()).optional(),
	}),
});
const subscriptionsSchema = z.object({
	data: z.array(subscriptionSchema).default([]),
	meta: z.object({ next_token: z.string().optional() }).optional(),
});
const userSchema = z.object({
	data: z.object({ id: z.string(), username: z.string() }),
});
const apiErrorsSchema = z.object({ errors: z.array(z.unknown()).optional() });

function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Set ${name}. See scripts/x-activity/README.md.`);
	return value;
}

/** Only X API endpoints here. OAuth credentials never reach Solid Imager or media URLs. */
async function xRequest(
	oauth: XOAuth,
	path: string,
	init: RequestInit = {},
): Promise<unknown> {
	const token = await oauth.accessToken();
	const response = await fetch(`https://api.x.com/2${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		signal: AbortSignal.timeout(30_000),
	});
	if (!response.ok)
		throw new Error(
			`X ${path.split("?")[0]} failed (HTTP ${response.status}). Check app access, scopes and credits.`,
		);
	const body: unknown = await response.json();
	if (apiErrorsSchema.parse(body).errors?.length)
		throw new Error(
			`X ${path.split("?")[0]} returned API errors. Check app access and subscription settings.`,
		);
	return body;
}

async function subscribe(oauth: XOAuth, userId: string): Promise<void> {
	let nextToken: string | undefined;
	do {
		const query = new URLSearchParams({ user_id: userId, max_results: "1000" });
		if (nextToken) query.set("pagination_token", nextToken);
		const page = subscriptionsSchema.parse(
			await xRequest(oauth, `/activity/subscriptions?${query}`),
		);
		const existing = page.data.find(
			(item) =>
				item.event_type === "like.create" &&
				item.filter.user_id === userId &&
				(item.filter.qualifiers?.direction ?? item.filter.direction) ===
					"outbound" &&
				!item.filter.keyword &&
				Object.keys(item.filter.qualifiers ?? {}).every(
					(key) => key === "direction",
				) &&
				!item.webhook_id &&
				(!item.expires_at || Date.parse(item.expires_at) > Date.now() + 60_000),
		);
		if (existing) {
			logger.info(
				{
					subscriptionId: existing.subscription_id,
					expiresAt: existing.expires_at,
				},
				"Using existing outbound like subscription",
			);
			return;
		}
		nextToken = page.meta?.next_token;
	} while (nextToken);
	// A bounded subscription is sufficient for this experiment, including after an abrupt stop.
	await xRequest(oauth, "/activity/subscriptions", {
		method: "POST",
		body: JSON.stringify({
			event_type: "like.create",
			filter: { user_id: userId, qualifiers: { direction: "outbound" } },
			tag: "solid-imager-x-likes",
			expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		}),
	});
	logger.info("Created outbound like subscription (expires in 24 hours)");
}

async function main(): Promise<void> {
	const { positionals, values } = parseArgs({
		args: process.argv.slice(2),
		allowPositionals: true,
		options: { help: { type: "boolean" }, capture: { type: "boolean" } },
	});
	const [command = "listen", replayPath] = positionals;
	if (values.help) {
		process.stdout.write(HELP);
		return;
	}
	if (!["auth", "listen", "sources", "replay"].includes(command))
		throw new Error(HELP);
	const directory = resolve(process.env.X_ACTIVITY_DIR || ".data/x-activity");
	if (command === "auth") {
		await new XOAuth(
			required("X_CLIENT_ID"),
			directory,
			process.env.X_CLIENT_SECRET,
		).authorize(process.env.X_REDIRECT_URI || "http://127.0.0.1:8788/callback");
		return;
	}
	const client = createClient<AppContract>({
		url: process.env.IMAGER_API_URL || "http://localhost:3000",
	});
	if (command === "sources") {
		const sources = await client.sources.list();
		process.stdout.write(
			`${JSON.stringify(
				sources.map(({ id, name }) => ({ id, name })),
				null,
				2,
			)}\n`,
		);
		return;
	}
	if (command === "replay" && !replayPath)
		throw new Error("Specify an events.ndjson file to replay.");
	let sourceId: string | undefined;
	if (!values.capture) {
		sourceId = z.uuid().parse(required("IMAGER_SOURCE_ID"));
		const sources = await client.sources.list();
		if (!sources.some((source) => source.id === sourceId))
			throw new Error(
				"IMAGER_SOURCE_ID was not found. Run sources to list available IDs.",
			);
	}
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const eventsPath = join(directory, "events.ndjson");
	const completedPath = join(directory, "queued.ndjson");
	const completed = new Set(
		existsSync(completedPath)
			? (await readFile(completedPath, "utf8")).split("\n").filter(Boolean)
			: [],
	);
	let userId = process.env.X_USER_ID;
	const stop = new AbortController();
	process.once("SIGINT", () => stop.abort());
	process.once("SIGTERM", () => stop.abort());

	async function processLine(line: string, record: boolean): Promise<void> {
		let body: unknown;
		try {
			body = JSON.parse(line);
		} catch {
			logger.warn("Ignoring a non-JSON activity frame");
			return;
		}
		const parsed = likeEventSchema.safeParse(body);
		if (!parsed.success) {
			// Preserve frames for diagnosing unexpected API shapes as well as missing media.
			if (record) await appendFile(eventsPath, `${line}\n`, { mode: 0o600 });
			logger.warn(
				"Activity frame did not match the like schema. Inspect events.ndjson.",
			);
			return;
		}
		const event = parsed.data;
		if (event.data.payload.liking_user_id !== userId) return;
		if (record) await appendFile(eventsPath, `${line}\n`, { mode: 0o600 });
		const eventId = event.data.event_uuid;
		const completionKey = `${sourceId}:${eventId}`;
		if (completed.has(completionKey)) return;
		const items = downloadsFromLike(event, userId);
		logger.info(
			{
				eventId,
				postId: event.data.payload.liked_tweet_id,
				photos: items.length,
				capture: Boolean(values.capture),
			},
			"Received X like",
		);
		if (!items.length) {
			logger.info(
				"No attached photo URLs available. Inspect the saved event for tweets, attachments and media.",
			);
			return;
		}
		if (values.capture || !sourceId) return;
		try {
			const result = await client.downloads.start({
				mediaSourceId: sourceId,
				items,
			});
			if (!result.success) throw new Error(result.message);
			await appendFile(completedPath, `${completionKey}\n`, { mode: 0o600 });
			completed.add(completionKey);
			logger.info(
				{
					eventId,
					jobCount: result.jobCount,
					skippedCount: result.skippedCount,
				},
				"Queued X photos in Solid Imager",
			);
		} catch (error) {
			logger.error(
				{ err: error, eventId },
				"Import failed. Use replay on events.ndjson to retry.",
			);
			if (!record) throw error;
		}
	}

	if (command === "replay") {
		if (!userId)
			throw new Error(
				"Set X_USER_ID to the numeric ID of the liking user for replay.",
			);
		for await (const line of readLines(Bun.file(resolve(replayPath)).stream()))
			await processLine(line, false);
		return;
	}
	const oauth = new XOAuth(
		required("X_CLIENT_ID"),
		directory,
		process.env.X_CLIENT_SECRET,
	);
	const user = userSchema.parse(await xRequest(oauth, "/users/me"));
	userId = user.data.id;
	logger.info(
		{ userId, username: user.data.username, eventsPath },
		"Listening for this user's likes",
	);
	await subscribe(oauth, userId);
	let backoff = 1000;
	while (!stop.signal.aborted) {
		try {
			const token = await oauth.accessToken();
			// Reconnect periodically to refresh the user token. A separate timer bounds header waits.
			const connection = new AbortController();
			const headerTimeout = setTimeout(() => connection.abort(), 30_000);
			let response: Response;
			try {
				response = await fetch("https://api.x.com/2/activity/stream", {
					headers: { Authorization: `Bearer ${token}` },
					signal: AbortSignal.any([
						stop.signal,
						connection.signal,
						AbortSignal.timeout(90 * 60 * 1000),
					]),
				});
			} finally {
				clearTimeout(headerTimeout);
			}
			if (!response.ok) {
				await response.body?.cancel();
				if ([400, 401, 403, 402].includes(response.status))
					throw new Error(
						`X stream rejected (HTTP ${response.status}). Check auth, app access and credits.`,
					);
				logger.warn({ status: response.status }, "X stream unavailable");
			} else {
				if (!response.body) throw new Error("X stream has no response body.");
				logger.info("X activity stream connected");
				for await (const line of readLines(response.body)) {
					backoff = 1000;
					await processLine(line, true);
				}
			}
		} catch (error) {
			if (stop.signal.aborted) break;
			// Authentication and configuration failures need user action, so surface them immediately.
			if (!(error instanceof TypeError) && !(error instanceof DOMException))
				throw error;
			logger.warn("X stream disconnected");
		}
		if (stop.signal.aborted) break;
		logger.info({ retryMs: backoff }, "Reconnecting X stream");
		try {
			await delay(backoff, undefined, { signal: stop.signal });
		} catch {
			break;
		}
		backoff = Math.min(backoff * 2, 60_000);
	}
}

if (import.meta.main) {
	await main().catch((error: unknown) => {
		logger.error({ err: error }, "X activity command failed");
		process.exitCode = 1;
	});
}
