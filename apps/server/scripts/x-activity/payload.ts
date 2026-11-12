import { z } from "zod";
import type { DownloadItem } from "@solid-imager/core/media";

const photoSchema = z.object({
	media_key: z.string(),
	type: z.string(),
	url: z.url().optional(),
});

export const likeEventSchema = z.object({
	data: z.object({
		event_uuid: z.string(),
		event_type: z.literal("like.create"),
		payload: z.object({
			liked_tweet_id: z.string(),
			liked_tweet_author_id: z.string(),
			liking_user_id: z.string(),
		}),
		includes: z
			.object({
				tweets: z
					.array(
						z.object({
							id: z.string(),
							author_id: z.string().optional(),
							text: z.string().optional(),
							created_at: z.iso.datetime().optional(),
							attachments: z
								.object({ media_keys: z.array(z.string()).optional() })
								.optional(),
						}),
					)
					.default([]),
				users: z
					.array(
						z.object({
							id: z.string(),
							username: z.string().optional(),
							name: z.string().optional(),
						}),
					)
					.default([]),
				media: z.array(photoSchema).default([]),
			})
			.default({ tweets: [], users: [], media: [] }),
	}),
});

export type LikeEvent = z.infer<typeof likeEventSchema>;

/** Only import media explicitly attached to the liked Post, preserving its author's identity. */
export function downloadsFromLike(
	event: LikeEvent,
	userId: string,
): DownloadItem[] {
	const { payload, includes } = event.data;
	if (payload.liking_user_id !== userId) return [];
	const tweet = includes.tweets.find(
		(item) => item.id === payload.liked_tweet_id,
	);
	if (
		!tweet ||
		(tweet.author_id && tweet.author_id !== payload.liked_tweet_author_id)
	)
		return [];
	const user = includes.users.find(
		(item) => item.id === payload.liked_tweet_author_id,
	);
	const postUrl = `https://x.com/i/web/status/${tweet.id}`;
	const mediaKeys = new Set(tweet.attachments?.media_keys ?? []);
	const seenUrls = new Set<string>();
	const items: DownloadItem[] = [];
	for (const media of includes.media) {
		if (!mediaKeys.has(media.media_key) || media.type !== "photo" || !media.url)
			continue;
		const imageUrl = new URL(media.url);
		// X's original photo CDN is also the download allowlist for this experimental importer.
		if (
			imageUrl.protocol !== "https:" ||
			imageUrl.hostname !== "pbs.twimg.com" ||
			!imageUrl.pathname.startsWith("/media/") ||
			imageUrl.port ||
			imageUrl.username ||
			imageUrl.password
		)
			continue;
		imageUrl.searchParams.set("name", "orig");
		const targetUrl = imageUrl.toString();
		if (seenUrls.has(targetUrl)) continue;
		seenUrls.add(targetUrl);
		items.push({
			targetUrl,
			sourceUrls: [targetUrl, postUrl],
			description: tweet.text,
			createdAt: tweet.created_at ? new Date(tweet.created_at) : undefined,
			authors: user?.username
				? [
						{
							name: user.name || user.username,
							platform: "twitter",
							accountId: user.username,
							remoteId: user.id,
							profileUrl: `https://x.com/${user.username}`,
							observedAt: new Date(),
						},
					]
				: undefined,
		});
	}
	return items;
}

/** Handles keepalives, CRLF, UTF-8 split across chunks and a final line without a newline. */
export async function* readLines(
	body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	try {
		while (true) {
			const { value, done } = await reader.read();
			buffer += done
				? decoder.decode()
				: decoder.decode(value, { stream: true });
			let newline = buffer.indexOf("\n");
			while (newline !== -1) {
				const line = buffer.slice(0, newline).trim();
				buffer = buffer.slice(newline + 1);
				if (line) yield line;
				newline = buffer.indexOf("\n");
			}
			if (done) break;
		}
		if (buffer.trim()) yield buffer.trim();
	} finally {
		await reader.cancel();
		reader.releaseLock();
	}
}
