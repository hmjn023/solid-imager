import { resolve } from "node:path";
import { call, implement } from "@orpc/server";
import type { ResponseHeadersHandlerPluginContext } from "@orpc/server/plugins";
import { mcp } from "@orpc/mcp";
import { mediaToolsContract as contract } from "@solid-imager/core/contract";
import {
	mediaContentPath,
	mediaThumbnailPath,
	resolveServerUrl,
} from "@solid-imager/core/http";
import type {
	MediaSafe,
	SimilarMediaSearchResponse,
} from "@solid-imager/core/media";
import { mediaToolOutputs } from "@solid-imager/core/media-tools";
import {
	getSearchConditionFromState,
	defaultState,
} from "@solid-imager/core/search";
import { mediaRouter } from "./media-router";
import { sourcesRouter } from "./sources-router";
import { tagsRouter } from "./tags-router";

interface MediaToolContext extends ResponseHeadersHandlerPluginContext {
	mediaOrigin: string;
}

const hints = (readOnlyHint: boolean, idempotentHint: boolean, name?: string) =>
	mcp.tool({
		name,
		annotations: { readOnlyHint, idempotentHint, openWorldHint: false },
	});

function withThumbnail<T extends Pick<MediaSafe, "id" | "mediaSourceId">>(
	media: T,
	origin: string,
) {
	return {
		...media,
		thumbnailUrl: resolveServerUrl(
			origin,
			mediaThumbnailPath(media.mediaSourceId, media.id),
		),
	};
}

function rankedSearchPage(result: SimilarMediaSearchResponse, origin: string) {
	const distances = new Map(
		result.scores.map(({ mediaId, cosineDistance }) => [
			mediaId,
			cosineDistance,
		]),
	);
	return {
		total: result.total,
		media: result.media.map((media) => ({
			...withThumbnail(media, origin),
			cosineDistance: distances.get(media.id),
		})),
	};
}

const readOnly = hints(true, true);
const os = implement({
	list_sources: contract.list_sources.meta(readOnly),
	create_local_source: contract.create_local_source.meta(hints(false, false)),
	search_media: contract.search_media.meta(readOnly),
	search_similar_media: contract.search_similar_media.meta(
		hints(false, true, "media_searchSimilar"),
	),
	search_semantic_media: contract.search_semantic_media.meta(
		hints(true, true, "media_searchSemantic"),
	),
	get_media_details: contract.get_media_details.meta(readOnly),
	find_tags: contract.find_tags.meta(readOnly),
	edit_media_tags: contract.edit_media_tags.meta(hints(false, true)),
}).$context<MediaToolContext>();
export const mediaToolsRouter = os.router({
	list_sources: os.list_sources.handler(async ({ input, context, signal }) => {
		const { path, limit, offset } = input;
		const sources = await call(sourcesRouter.list, undefined, {
			context,
			signal,
		});
		const summaries = sources.map(({ id, name, type, connectionInfo }) => ({
			id,
			name,
			type,
			directory:
				type === "local" && "path" in connectionInfo
					? connectionInfo.path
					: undefined,
		}));
		const localPath = path === undefined ? undefined : resolve(path);
		const matches =
			localPath === undefined
				? summaries
				: summaries.filter(
						({ directory }) =>
							directory !== undefined && resolve(directory) === localPath,
					);
		const pageEnd = offset + limit;
		return mediaToolOutputs.list_sources.parse({
			sources: matches
				.toSorted(
					(a, b) =>
						a.name.localeCompare(b.name) ||
						(a.id ?? "").localeCompare(b.id ?? ""),
				)
				.slice(offset, pageEnd),
			total: matches.length,
			nextOffset: pageEnd < matches.length ? pageEnd : null,
		});
	}),
	create_local_source: os.create_local_source.handler(
		async ({ input: { name, path, description }, context, signal }) => {
			const source = await call(
				sourcesRouter.create,
				{ name, description, type: "local", connectionInfo: { path } },
				{ context, signal },
			);
			return mediaToolOutputs.create_local_source.parse({
				source,
				scan: "scheduled",
			});
		},
	),
	search_media: os.search_media.handler(
		async ({
			input: { sourceId, query, tags, limit, offset },
			context,
			signal,
		}) => {
			const condition = getSearchConditionFromState({
				...defaultState,
				searchQuery: query,
				selectedTags: tags,
			});
			const result = await call(
				mediaRouter.search,
				{
					sourceId,
					params: { condition, sort: "date", order: "desc", limit, offset },
				},
				{ context, signal },
			);
			return mediaToolOutputs.search_media.parse({
				total: result.total,
				media: result.media.map((media) =>
					withThumbnail(media, context.mediaOrigin),
				),
			});
		},
	),
	search_similar_media: os.search_similar_media.handler(
		async ({ input, context, signal }) => {
			const result = await call(mediaRouter.searchSimilar, input, {
				context,
				signal,
			});
			return mediaToolOutputs.search_similar_media.parse(
				rankedSearchPage(result, context.mediaOrigin),
			);
		},
	),
	search_semantic_media: os.search_semantic_media.handler(
		async ({ input, context, signal }) => {
			const result = await call(mediaRouter.searchSemantic, input, {
				context,
				signal,
			});
			return mediaToolOutputs.search_semantic_media.parse(
				rankedSearchPage(result, context.mediaOrigin),
			);
		},
	),
	get_media_details: os.get_media_details.handler(
		async ({ input, context, signal }) => {
			const media = await call(mediaRouter.getDetails, input, {
				context,
				signal,
			});
			return mediaToolOutputs.get_media_details.parse({
				...withThumbnail(media, context.mediaOrigin),
				contentUrl: resolveServerUrl(
					context.mediaOrigin,
					mediaContentPath(input.sourceId, input.mediaId),
				),
			});
		},
	),
	find_tags: os.find_tags.handler(
		async ({ input: { query, limit, offset }, context, signal }) => {
			const tags = await call(tagsRouter.list, undefined, { context, signal });
			const needle = query.toLowerCase();
			const matches = tags
				.filter((tag) => tag.name.toLowerCase().includes(needle))
				.sort(
					(a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
				);
			return {
				total: matches.length,
				tags: matches
					.slice(offset, offset + limit)
					.map(({ id, name }) => ({ id, name })),
			};
		},
	),
	edit_media_tags: os.edit_media_tags.handler(
		({ input: { sourceId, mediaId, action, tagIds }, context, signal }) =>
			call(
				mediaRouter.bulkTag,
				{
					mediaSourceId: sourceId,
					mediaIds: [mediaId],
					tagsToAdd: action === "add" ? tagIds : [],
					tagsToRemove: action === "remove" ? tagIds : [],
				},
				{ context, signal },
			),
	),
});
