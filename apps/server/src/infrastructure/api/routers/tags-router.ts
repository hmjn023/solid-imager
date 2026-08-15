import { implement } from "@orpc/server";
import { tagsContract } from "@solid-imager/core/domain/contract/tags.contract";
import { TagService } from "~/infrastructure/services/tag-service";

/**
 * Tags Router Implementation
 */
const os = implement(tagsContract);

export const tagsRouter = os.router({
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
