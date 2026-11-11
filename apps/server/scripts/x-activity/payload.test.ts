import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { implement } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { appContract } from "@solid-imager/core/contract";
import { downloadItemSchema } from "@solid-imager/core/media";
import { downloadsFromLike, likeEventSchema, readLines } from "./payload";

export function likeFixture() {
	return {
		data: {
			event_uuid: "event-1",
			event_type: "like.create",
			payload: {
				liked_tweet_id: "100",
				liked_tweet_author_id: "200",
				liking_user_id: "300",
			},
			includes: {
				tweets: [
					{
						id: "999",
						author_id: "999",
						text: "unrelated",
						attachments: { media_keys: ["other"] },
					},
					{
						id: "100",
						author_id: "200",
						text: "写真",
						created_at: "2026-11-09T00:00:00.000Z",
						attachments: { media_keys: ["photo-1", "video-1", "photo-2"] },
					},
				],
				users: [
					{ id: "300", username: "liker", name: "Liker" },
					{ id: "200", username: "artist", name: "Artist" },
				],
				media: [
					{
						media_key: "other",
						type: "photo",
						url: "https://pbs.twimg.com/media/unrelated.jpg",
					},
					{
						media_key: "photo-1",
						type: "photo",
						url: "https://pbs.twimg.com/media/one.jpg?name=small",
					},
					{
						media_key: "video-1",
						type: "video",
						url: "https://pbs.twimg.com/media/preview.jpg",
					},
					{
						media_key: "photo-2",
						type: "photo",
						url: "https://pbs.twimg.com/media/two?format=png&name=large",
					},
				],
			},
		},
	};
}

describe("X activity photos", () => {
	it("maps only attached photos and the actual author's stable identity to the existing import contract", () => {
		const items = downloadsFromLike(
			likeEventSchema.parse(likeFixture()),
			"300",
		);
		expect(items).toHaveLength(2);
		expect(items[0]).toMatchObject({
			targetUrl: "https://pbs.twimg.com/media/one.jpg?name=orig",
			description: "写真",
			createdAt: new Date("2026-11-09T00:00:00.000Z"),
			authors: [
				{
					name: "Artist",
					accountId: "artist",
					remoteId: "200",
					platform: "twitter",
				},
			],
		});
		expect(items[1].targetUrl).toContain("format=png&name=orig");
		expect(items[0].sourceUrls).toEqual([
			"https://pbs.twimg.com/media/one.jpg?name=orig",
			"https://x.com/i/web/status/100",
		]);
		expect(downloadItemSchema.array().safeParse(items).success).toBe(true);
	});

	it("ignores inbound likes and other users' likes", () => {
		expect(
			downloadsFromLike(likeEventSchema.parse(likeFixture()), "200"),
		).toEqual([]);
	});

	it("preserves a valid notification without includes for payload inspection", () => {
		const fixture = likeFixture();
		const event = likeEventSchema.parse({
			data: { ...fixture.data, includes: undefined },
		});
		expect(downloadsFromLike(event, "300")).toEqual([]);
	});

	it("does not associate unrelated photos when attachment keys are missing", () => {
		const event = likeEventSchema.parse(likeFixture());
		event.data.includes.tweets[1].attachments = undefined;
		expect(downloadsFromLike(event, "300")).toEqual([]);
	});

	it("does not attribute a mismatched tweet to the liked tweet's author", () => {
		const event = likeEventSchema.parse(likeFixture());
		event.data.includes.tweets[1].author_id = "999";
		expect(downloadsFromLike(event, "300")).toEqual([]);
	});

	it("does not invent a handle when the author's user object is absent", () => {
		const event = likeEventSchema.parse(likeFixture());
		event.data.includes.users = [];
		expect(downloadsFromLike(event, "300")[0].authors).toBeUndefined();
	});

	it("deduplicates photos and rejects non-photo CDN targets", () => {
		const event = likeEventSchema.parse(likeFixture());
		event.data.includes.media.push({ ...event.data.includes.media[1] });
		event.data.includes.media[3].url = "https://localhost/private";
		expect(downloadsFromLike(event, "300")).toHaveLength(1);
	});

	it("decodes chunk boundaries, keepalives, CRLF and the final unterminated frame", async () => {
		const bytes = new TextEncoder().encode(
			'\r\n{"text":"写真"}\r\n\n{"last":true}',
		);
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
				controller.close();
			},
		});
		const lines: string[] = [];
		for await (const line of readLines(body)) lines.push(line);
		expect(lines).toEqual(['{"text":"写真"}', '{"last":true}']);
	});
});

it("replays through the real CLI and RPC codec, retries failed submissions and suppresses queued events", async () => {
	const directory = await mkdtemp(join(tmpdir(), "x-activity-replay-"));
	const sourceId = "11111111-1111-4111-8111-111111111111";
	const queued: string[] = [];
	let fail = true;
	const os = implement({
		sources: { list: appContract.sources.list },
		downloads: appContract.downloads,
	});
	const handler = new RPCHandler(
		os.router({
			sources: {
				list: os.sources.list.handler(() => [
					{
						id: sourceId,
						name: "Test",
						description: null,
						type: "local",
						connectionInfo: { path: directory },
					},
				]),
			},
			downloads: {
				start: os.downloads.start.handler(({ input }) => {
					if (fail) throw new Error("Simulated server failure");
					queued.push(...input.items.map((item) => item.targetUrl ?? ""));
					return {
						success: true,
						jobCount: input.items.length,
						skippedCount: 0,
						message: "Queued",
					};
				}),
			},
		}),
	);
	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		async fetch(request) {
			const result = await handler.handle(request, { prefix: "/api/rpc" });
			return result.response ?? new Response("Not found", { status: 404 });
		},
	});
	const eventsPath = join(directory, "fixture.ndjson");
	await writeFile(eventsPath, JSON.stringify(likeFixture()) + "\n");
	async function replay() {
		const child = Bun.spawn(
			[
				process.execPath,
				join(import.meta.dir, "../x-activity.ts"),
				"replay",
				eventsPath,
			],
			{
				cwd: join(import.meta.dir, "../.."),
				stdout: "pipe",
				stderr: "pipe",
				env: {
					...process.env,
					X_ACTIVITY_DIR: directory,
					X_USER_ID: "300",
					IMAGER_SOURCE_ID: sourceId,
					IMAGER_API_URL: `http://127.0.0.1:${server.port}`,
				},
			},
		);
		const [stdout, stderr, code] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
		return { stdout, stderr, code };
	}
	try {
		expect((await replay()).code).toBe(1);
		fail = false;
		const success = await replay();
		expect(success.code, success.stdout + success.stderr).toBe(0);
		expect(queued).toHaveLength(2);
		expect((await replay()).code).toBe(0);
		expect(queued).toHaveLength(2);
		expect(await readFile(join(directory, "queued.ndjson"), "utf8")).toBe(
			`${sourceId}:event-1\n`,
		);
	} finally {
		await server.stop(true);
		await rm(directory, { recursive: true, force: true });
	}
});

it("captures photos without a source setting or any Solid Imager requests", async () => {
	const directory = await mkdtemp(join(tmpdir(), "x-activity-capture-"));
	const requests: string[] = [];
	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch(request) {
			requests.push(request.url);
			return new Response("Solid Imager must not be needed for capture", {
				status: 503,
			});
		},
	});
	try {
		const eventsPath = join(directory, "fixture.ndjson");
		const events = JSON.stringify(likeFixture()) + "\n";
		await writeFile(eventsPath, events);
		const env: Record<string, string | undefined> = {
			...process.env,
			X_ACTIVITY_DIR: directory,
			X_USER_ID: "300",
			IMAGER_API_URL: `http://127.0.0.1:${server.port}`,
		};
		delete env.IMAGER_SOURCE_ID;
		const child = Bun.spawn(
			[
				process.execPath,
				join(import.meta.dir, "../x-activity.ts"),
				"replay",
				eventsPath,
				"--capture",
			],
			{ cwd: directory, env, stdout: "pipe", stderr: "pipe" },
		);
		const [stdout, stderr, code] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
		expect(code, stdout + stderr).toBe(0);
		expect(stdout).toContain('"photos":2');
		expect(requests).toEqual([]);
		expect(await readFile(eventsPath, "utf8")).toBe(events);
		expect(await Bun.file(join(directory, "queued.ndjson")).exists()).toBe(
			false,
		);
	} finally {
		await server.stop(true);
		await rm(directory, { recursive: true, force: true });
	}
});
