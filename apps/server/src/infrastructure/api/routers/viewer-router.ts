import { danbooruSearchSchema } from "@solid-imager/core/danbooru";
import { implement, ORPCError } from "@orpc/server";
import { viewerContract } from "@solid-imager/core/contract";
import {
	danbooruService,
	DanbooruRequestError,
} from "~/infrastructure/services/danbooru-service";
import { pixivService } from "~/infrastructure/services/pixiv-service";
import {
	resolvePixivQuery,
	suggestViewerTags,
} from "~/infrastructure/services/viewer-tags";
const os = implement(viewerContract);
async function readViewer<T>(operation: () => Promise<T>): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		if (error instanceof ORPCError) throw error;
		if (error instanceof DanbooruRequestError)
			throw new ORPCError(
				error.status === 429
					? "TOO_MANY_REQUESTS"
					: error.status === 422
						? "BAD_REQUEST"
						: "BAD_GATEWAY",
				{ message: error.message },
			);
		throw new ORPCError("BAD_GATEWAY", {
			message: "外部サイトの応答を読み取れませんでした。",
		});
	}
}
export const viewerRouter = os.router({
	search: os.search.handler(({ input }) =>
		readViewer(async () => {
			if (input.provider === "danbooru")
				return {
					provider: "danbooru" as const,
					...(await danbooruService.search(danbooruSearchSchema.parse(input))),
				};
			const query = await resolvePixivQuery(input.tags, input.choices);
			return {
				provider: "pixiv" as const,
				...query,
				...(await pixivService.search(query.word, input.page)),
			};
		}),
	),
	suggestTags: os.suggestTags.handler(({ input }) =>
		readViewer(() => suggestViewerTags(input.query)),
	),
	pixivArtwork: os.pixivArtwork.handler(({ input }) =>
		readViewer(() => pixivService.getPost(input.id)),
	),
});
