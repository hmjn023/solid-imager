import { call, implement } from "@orpc/server";
import { mcp } from "@orpc/mcp";
import { mediaToolsContract as contract } from "@solid-imager/core/domain/contract/media-tools.contract";
import { mediaToolOutputs } from "@solid-imager/core/domain/media/tool-schemas";
import { getSearchConditionFromState } from "@solid-imager/core/domain/search/logic";
import { defaultState } from "@solid-imager/core/domain/search/schema";
import { mediaRouter } from "./media-router";
import { sourcesRouter } from "./sources-router";
import { tagsRouter } from "./tags-router";

const hints = (readOnlyHint: boolean, idempotentHint: boolean) =>
	mcp.tool({
		annotations: { readOnlyHint, idempotentHint, openWorldHint: false },
	});
const readOnly = hints(true, true);
// Only this router is registered with MCP. The full app router contains administrative procedures.
const os = implement({
	list_sources: contract.list_sources.meta(readOnly),
	create_local_source: contract.create_local_source.meta(hints(false, false)),
	search_media: contract.search_media.meta(readOnly),
	get_media_details: contract.get_media_details.meta(readOnly),
	find_tags: contract.find_tags.meta(readOnly),
	edit_media_tags: contract.edit_media_tags.meta(hints(false, true)),
});
export const mediaToolsRouter = os.router({
	list_sources: os.list_sources.handler(async ({ context, signal }) => ({
		sources: await call(sourcesRouter.list, undefined, { context, signal }),
	})),
	create_local_source: os.create_local_source.handler(
		async ({ input: { name, path, description }, context, signal }) => ({
			source: await call(
				sourcesRouter.create,
				{ name, description, type: "local", connectionInfo: { path } },
				{ context, signal },
			),
		}),
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
			return mediaToolOutputs.search_media.parse(result);
		},
	),
	get_media_details: os.get_media_details.handler(
		async ({ input, context, signal }) =>
			mediaToolOutputs.get_media_details.parse(
				await call(mediaRouter.getDetails, input, { context, signal }),
			),
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
