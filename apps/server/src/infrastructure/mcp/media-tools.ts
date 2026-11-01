import type { ContractRouterClient } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/domain/contract";
import {
	mediaGenerationInfoSchema,
	mediaSafeSchema,
} from "@solid-imager/core/domain/media/schemas";
import { getSearchConditionFromState } from "@solid-imager/core/domain/search/logic";
import { defaultState } from "@solid-imager/core/domain/search/schema";
import {
	localConnectionSchema,
	mediaSourceInfoSchema,
	safeMediaSourceSchema,
} from "@solid-imager/core/domain/sources/schemas";
import { z } from "zod";

const locationSchema = z.strictObject({
	sourceId: z.uuid(),
	mediaId: z.uuid(),
});
const pagination = {
	limit: z.int().min(1).max(100).default(20),
	offset: z.int().nonnegative().default(0),
};
const generationSummary = mediaGenerationInfoSchema
	.pick({
		aiGenerated: true,
		prompt: true,
		negativePrompt: true,
		modelName: true,
		seed: true,
		cfgScale: true,
		steps: true,
	})
	.nullable();

export function defineTool<Schema extends z.ZodObject, Result extends object>(
	name: string,
	description: string,
	readOnly: boolean,
	inputSchema: Schema,
	run: (input: z.output<Schema>, signal: AbortSignal) => Promise<Result>,
	idempotent = true,
) {
	return {
		name,
		description,
		readOnly,
		idempotent,
		inputSchema,
		execute: (input: unknown, signal: AbortSignal) =>
			run(inputSchema.parse(input), signal),
	};
}

export function createMediaTools(
	client: ContractRouterClient<AppContract>,
	onTagsEdited?: (location: z.infer<typeof locationSchema>) => void,
	onSourceCreated?: () => void,
) {
	return [
		defineTool(
			"list_sources",
			"List registered media sources and their IDs. Check for an existing local path before creating a source.",
			true,
			z.strictObject({}),
			async (input, signal) => {
				const sources = await client.sources.list(undefined, { signal });
				return {
					sources: sources.map((source) => safeMediaSourceSchema.parse(source)),
				};
			},
		),
		defineTool(
			"create_local_source",
			"Register a local directory on the server as a media source. Starts file monitoring and an initial scan. Check list_sources first to avoid duplicate registrations.",
			false,
			z.strictObject({
				name: mediaSourceInfoSchema.shape.name.trim().min(1),
				path: localConnectionSchema.shape.path,
				description: mediaSourceInfoSchema.shape.description.default(null),
			}),
			async ({ name, path, description }, signal) => {
				const source = await client.sources.create(
					{
						name,
						description,
						type: "local",
						connectionInfo: { path },
					},
					{ signal },
				);
				onSourceCreated?.();
				return { source: safeMediaSourceSchema.parse(source) };
			},
			false,
		),
		defineTool(
			"search_media",
			"Search the media library by keyword or tag. Omit the filters to browse the newest media. Use each item's mediaSourceId and id for details or tag edits.",
			true,
			z.strictObject({
				sourceId: z.uuid().optional(),
				query: z.string().trim().max(500).default(""),
				tags: z.array(z.string().trim().min(1)).max(20).default([]),
				...pagination,
			}),
			async ({ sourceId, query, tags, limit, offset }, signal) => {
				const condition = getSearchConditionFromState({
					...defaultState,
					searchQuery: query,
					selectedTags: tags,
				});
				const { media, total } = await client.media.search(
					{
						sourceId,
						params: { condition, sort: "date", order: "desc", limit, offset },
					},
					{ signal },
				);
				return {
					total,
					media: media.map((item) => mediaSafeSchema.parse(item)),
				};
			},
		),
		defineTool(
			"get_media_details",
			"Get a media item's metadata, generation parameters, authors, characters, IPs and assigned tags.",
			true,
			locationSchema,
			async (location, signal) => {
				const item = await client.media.getDetails(location, { signal });
				return {
					...mediaSafeSchema.parse(item),
					generationInfo: generationSummary.parse(item.generationInfo),
					tags: item.tags.map(({ id, name, type }) => ({ id, name, type })),
					authors: item.authors.map(({ id, name }) => ({ id, name })),
					characters: item.characters.map(({ id, name }) => ({ id, name })),
					ips: item.ips.map(({ id, name }) => ({ id, name })),
				};
			},
		),
		defineTool(
			"find_tags",
			"Look up existing library tags by name to get their IDs for editing media.",
			true,
			z.strictObject({
				query: z.string().trim().max(500).default(""),
				...pagination,
			}),
			async ({ query, offset, limit }, signal) => {
				const tags = await client.tags.list(undefined, { signal });
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
		defineTool(
			"edit_media_tags",
			"Add existing tags to one media item as positive tags, or remove both positive and negative assignments for the specified tag IDs.",
			false,
			locationSchema.extend({
				action: z.enum(["add", "remove"]),
				tagIds: z.array(z.uuid()).min(1).max(100),
			}),
			async ({ sourceId, mediaId, action, tagIds }, signal) => {
				const result = await client.media.bulkTag(
					{
						mediaSourceId: sourceId,
						mediaIds: [mediaId],
						tagsToAdd: action === "add" ? tagIds : [],
						tagsToRemove: action === "remove" ? tagIds : [],
					},
					{ signal },
				);
				onTagsEdited?.({ sourceId, mediaId });
				return result;
			},
		),
	] as const;
}
