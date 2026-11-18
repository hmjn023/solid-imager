import { implement, ORPCError } from "@orpc/server";
import { mcp } from "@orpc/mcp";
import { tagsContract } from "@solid-imager/core/contract";
import { TagDictionaryRepository } from "~/infrastructure/db/repositories";
import {
	getTagDictionaryDetail,
	queueTagDictionaryRefresh,
} from "~/infrastructure/services/tag-dictionary-service";
import { TagService } from "~/infrastructure/services/tag-service";

/**
 * Tags Router Implementation
 */
const readOnly = mcp.tool({ annotations: { readOnlyHint: true } });
const os = implement({
	...tagsContract,
	list: tagsContract.list.meta(readOnly),
	get: tagsContract.get.meta(readOnly),
});

export const tagsRouter = os.router({
	dictionarySearch: os.dictionarySearch.handler(({ input }) =>
		TagDictionaryRepository.search(input),
	),
	dictionaryDetail: os.dictionaryDetail.handler(({ input }) =>
		getTagDictionaryDetail(input.name),
	),
	dictionaryStatus: os.dictionaryStatus.handler(() =>
		TagDictionaryRepository.status(),
	),
	dictionaryRefresh: os.dictionaryRefresh.handler(() =>
		queueTagDictionaryRefresh("manual"),
	),
	dictionaryLegacy: os.dictionaryLegacy.handler(({ input }) =>
		TagDictionaryRepository.listLegacy(input),
	),
	dictionaryMigrate: os.dictionaryMigrate.handler(async ({ input }) => {
		if (!(await TagDictionaryRepository.migrateLegacy(input))) {
			throw new ORPCError("CONFLICT", {
				message: "Tag migration is no longer available",
			});
		}
		return { success: true };
	}),

	list: os.list.handler(async () => await TagService.getAllTags()),

	get: os.get.handler(async ({ input }) => {
		const tag = await TagService.getTagById(input.id);
		if (!tag) {
			throw new Error(`Tag not found: ${input.id}`);
		}
		return tag;
	}),

	create: os.create.handler(
		async ({ input }) => await TagService.createTag(input),
	),

	update: os.update.handler(async ({ input }) => {
		const updatedTag = await TagService.updateTag(input.id, input.data);
		if (!updatedTag) {
			throw new Error(`Tag not found: ${input.id}`);
		}
		return updatedTag;
	}),

	delete: os.delete.handler(async ({ input }) => {
		const tag = await TagService.getTagById(input.id);
		if (!tag) {
			throw new Error(`Tag not found: ${input.id}`);
		}
		await TagService.deleteTag(input.id);
		return { success: true };
	}),
});
