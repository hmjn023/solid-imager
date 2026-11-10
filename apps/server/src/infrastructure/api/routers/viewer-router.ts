import { danbooruSearchSchema } from "@solid-imager/core/danbooru";
import { implement, ORPCError } from "@orpc/server";
import { viewerContract } from "@solid-imager/core/contract";
import {
	danbooruService,
	DanbooruRequestError,
} from "~/infrastructure/services/danbooru-service";
import {
	pixivBearerToken,
	pixivSessions,
} from "~/infrastructure/services/pixiv-sessions";
import { createPixivService } from "~/infrastructure/services/pixiv-service";
import {
	resolvePixivQuery,
	suggestViewerTags,
} from "~/infrastructure/services/viewer-tags";
type ViewerContext = { pixivAuthorization?: string };
const os = implement(viewerContract).$context<ViewerContext>();
const service = (context: ViewerContext) =>
	createPixivService(
		fetch,
		pixivSessions.credential(pixivBearerToken(context.pixivAuthorization)),
	);
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
	issuePixivCode: os.issuePixivCode.handler(({ input }) =>
		pixivSessions.issue(input.sessionId),
	),
	loginPixiv: os.loginPixiv.handler(({ input }) =>
		pixivSessions.login(input.code),
	),
	checkPixivSession: os.checkPixivSession.handler(({ context }) =>
		pixivSessions.check(pixivBearerToken(context.pixivAuthorization) ?? ""),
	),
	logoutPixiv: os.logoutPixiv.handler(({ context }) => {
		pixivSessions.logout(pixivBearerToken(context.pixivAuthorization) ?? "");
		return null;
	}),
	search: os.search.handler(({ input, context }) =>
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
				...(await service(context).search(query.word, input.page)),
			};
		}),
	),
	suggestTags: os.suggestTags.handler(({ input }) =>
		readViewer(() => suggestViewerTags(input.query)),
	),
	pixivArtwork: os.pixivArtwork.handler(({ input, context }) =>
		readViewer(() => service(context).getPost(input.id)),
	),
});
