import { os } from "@orpc/server";
import {
	newProjectSchema,
	updateProjectSchema,
} from "@solid-imager/core/domain/projects/schemas";
import { z } from "zod";
import { ProjectService } from "~/application/services/project-service";

/**
 * Projects Router Implementation
 */
export const projectsRouter = {
	list: os.handler(() => ProjectService.list()),

	get: os
		.input(z.object({ id: z.string().uuid() }))
		.handler(async ({ input }) => {
			const project = await ProjectService.get(input.id);
			if (!project) {
				throw new Error(`Project not found: ${input.id}`);
			}
			return project;
		}),

	create: os
		.input(newProjectSchema)
		.handler(({ input }) => ProjectService.create(input)),

	update: os
		.input(
			z.object({
				id: z.string().uuid(),
				data: updateProjectSchema,
			}),
		)
		.handler(async ({ input }) => {
			const updated = await ProjectService.update(input.id, input.data);
			if (!updated) {
				throw new Error(`Project not found: ${input.id}`);
			}
			return updated;
		}),

	delete: os
		.input(z.object({ id: z.string().uuid() }))
		.handler(({ input }) => ProjectService.delete(input.id)),

	// Media association
	listForMedia: os
		.input(z.object({ mediaId: z.string().uuid() }))
		.handler(({ input }) => ProjectService.listForMedia(input.mediaId)),

	addToMedia: os
		.input(
			z.object({
				mediaId: z.string().uuid(),
				projectId: z.string().uuid(),
			}),
		)
		.handler(({ input }) =>
			ProjectService.addToMedia(input.mediaId, input.projectId),
		),

	removeFromMedia: os
		.input(
			z.object({
				mediaId: z.string().uuid(),
				projectId: z.string().uuid(),
			}),
		)
		.handler(({ input }) =>
			ProjectService.removeFromMedia(input.mediaId, input.projectId),
		),
};
