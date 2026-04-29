import { os } from "@orpc/server";
import {
	newTagSchema,
	updateTagSchema,
} from "@solid-imager/core/domain/tags/schemas";
import { z } from "zod";
import { TagService } from "~/application/services/tag-service";

/**
 * Tags Router Implementation
 */
export const tagsRouter = {
	list: os.handler(async () => await TagService.list()),

	get: os
		.input(
			z.object({
				id: z.string().uuid(),
			}),
		)
		.handler(async ({ input }) => {
			const tag = await TagService.get(input.id);
			if (!tag) {
				throw new Error(`Tag not found: ${input.id}`);
			}
			return tag;
		}),

	create: os
		.input(newTagSchema)
		.handler(async ({ input }) => await TagService.create(input)),

	update: os
		.input(
			z.object({
				id: z.string().uuid(),
				data: updateTagSchema,
			}),
		)
		.handler(async ({ input }) => {
			const updatedTag = await TagService.update(input.id, input.data);
			if (!updatedTag) {
				throw new Error(`Tag not found: ${input.id}`);
			}
			return updatedTag;
		}),

	delete: os
		.input(
			z.object({
				id: z.string().uuid(),
			}),
		)
		.handler(async ({ input }) => {
			const tag = await TagService.get(input.id);
			if (!tag) {
				throw new Error(`Tag not found: ${input.id}`);
			}
			await TagService.delete(input.id);
			return { success: true };
		}),
};
