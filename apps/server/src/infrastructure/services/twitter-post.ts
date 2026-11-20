import { z } from "zod";
import { waitForDownloadRateLimit } from "~/infrastructure/jobs/download-rate-limiter";

const TWITTER_HOSTS = new Set([
	"x.com",
	"www.x.com",
	"mobile.x.com",
	"twitter.com",
	"www.twitter.com",
	"mobile.twitter.com",
	"vxtwitter.com",
	"fxtwitter.com",
	"fixupx.com",
]);
const POST_PATH =
	/^\/(?:\w+\/status|i\/web\/status)\/(\d+)(?:\/video\/(\d+))?(?:\/|$)/;
const postSchema = z.object({
	tweetID: z.string(),
	text: z.string().optional(),
	date_epoch: z.number().int().nonnegative().max(8_640_000_000_000),
	media_extended: z.array(
		z.object({
			type: z.string(),
			url: z.string(),
			size: z
				.object({
					width: z.number().int().positive(),
					height: z.number().int().positive(),
				})
				.nullish(),
		}),
	),
});

export function getTwitterPostReference(value: string) {
	const url = URL.parse(value);
	if (
		!url ||
		!["http:", "https:"].includes(url.protocol) ||
		!TWITTER_HOSTS.has(url.hostname)
	)
		return;
	const match = POST_PATH.exec(url.pathname);
	if (!match) return;
	return {
		id: match[1],
		videoIndex: match[2] ? Number(match[2]) - 1 : undefined,
	};
}

export async function fetchTwitterPost(postId: string) {
	await waitForDownloadRateLimit();
	const response = await fetch(`https://api.vxtwitter.com/i/status/${postId}`, {
		headers: { Accept: "application/json" },
		redirect: "error",
		signal: AbortSignal.timeout(15_000),
	});
	if (!response.ok)
		throw new Error(`vxTwitter returned HTTP ${response.status}`);
	if (
		response.headers.get("content-type")?.split(";", 1)[0] !==
		"application/json"
	) {
		throw new Error("vxTwitter returned a non-JSON response");
	}
	const post = postSchema.parse(await response.json());
	if (post.tweetID !== postId)
		throw new Error("vxTwitter returned a different post");

	const videos = post.media_extended.flatMap((entry, index) => {
		if (entry.type !== "video" && entry.type !== "gif") return [];
		const url = URL.parse(entry.url);
		if (
			!url ||
			url.protocol !== "https:" ||
			url.port ||
			url.username ||
			url.password ||
			url.hostname !== "video.twimg.com" ||
			!url.pathname.endsWith(".mp4")
		)
			return [];
		return [{ ...entry, index }];
	});
	return { text: post.text, dateEpoch: post.date_epoch, videos };
}
