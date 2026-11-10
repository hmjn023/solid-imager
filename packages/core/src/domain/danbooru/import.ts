import type { DownloadItem } from "../media/schemas";
import type { DanbooruPost } from "./schemas";
import { getDanbooruMediaType } from "./media";

export function getDanbooruPostUrl(id: number): string {
	return `https://danbooru.donmai.us/posts/${id}`;
}

/** Preserve the remote identity and categorized metadata when saving a post. */
export function danbooruPostToDownloadItem(
	post: DanbooruPost,
): DownloadItem | null {
	if (!post.fileUrl || getDanbooruMediaType(post.fileExt) !== "image")
		return null;
	const postUrl = getDanbooruPostUrl(post.id);
	let sourceUrl: string | undefined;
	try {
		const source = new URL(post.source);
		if (source.protocol === "https:" || source.protocol === "http:")
			sourceUrl = source.href;
	} catch {
		// Danbooru's source can be a non-URL attribution string.
	}
	return {
		targetUrl: post.fileUrl,
		sourceUrls: [
			...new Set([post.fileUrl, ...(sourceUrl ? [sourceUrl] : []), postUrl]),
		],
		description: `Danbooru Post #${post.id}`,
		createdAt: new Date(post.createdAt),
		authors: post.tags.artist.map((name) => ({
			name,
			accountId: name,
			platform: "danbooru",
		})),
		characters: post.tags.character.map((name) => ({
			name,
			source: "danbooru",
		})),
		ips: post.tags.copyright.map((name) => ({ name, source: "danbooru" })),
		tags: [...post.tags.general, ...post.tags.meta].map((name) => ({
			name,
			type: "positive",
			source: "danbooru",
		})),
	};
}
