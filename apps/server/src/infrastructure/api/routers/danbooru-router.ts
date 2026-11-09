import { implement, ORPCError } from "@orpc/server";
import { danbooruContract } from "@solid-imager/core/contract";
import {
	DanbooruRequestError,
	danbooruService,
} from "~/infrastructure/services/danbooru-service";

const os = implement(danbooruContract);
async function upstream<T>(operation: () => Promise<T>): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		if (error instanceof DanbooruRequestError) {
			const code =
				error.status === 404
					? "NOT_FOUND"
					: error.status === 429
						? "TOO_MANY_REQUESTS"
						: error.status === 422
							? "BAD_REQUEST"
							: "BAD_GATEWAY";
			throw new ORPCError(code, { message: error.message });
		}
		throw new ORPCError("BAD_GATEWAY", {
			message: "Danbooru の応答形式を読み取れませんでした。",
		});
	}
}
export const danbooruRouter = os.router({
	search: os.search.handler(({ input }) =>
		upstream(() => danbooruService.search(input)),
	),
	getPost: os.getPost.handler(({ input }) =>
		upstream(() => danbooruService.getPost(input.id)),
	),
	suggestTags: os.suggestTags.handler(({ input }) =>
		upstream(() => danbooruService.suggestTags(input.query)),
	),
});
