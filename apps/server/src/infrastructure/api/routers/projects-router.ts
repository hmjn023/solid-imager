import { os } from "@orpc/server";
import {
	newProjectSchema,
	updateProjectSchema,
} from "@solid-imager/core/domain/projects/schemas";
import { z } from "zod";
import { ProjectService } from "~/application/services/project-service";
import { getProjectMediaCounts } from "./entity-media-counts";

/**
 * Projects Router Implementation
 */
export const projectsRouter = {
	list: os.handler(async () => {
		const projects = await ProjectService.getAllProjects();
		const mediaCounts = await getProjectMediaCounts(
			projects.map((project) => project.id),
		);
		return projects.map((project) => ({
			...project,
			mediaCount: mediaCounts.get(project.id) ?? 0,
		}));
	}),

	get: os
		.input(z.object({ id: z.string().uuid() }))
		.handler(async ({ input }) => {
			const project = await ProjectService.getProjectDetails(input.id);
			if (!project) {
				throw new Error(`Project not found: ${input.id}`);
			}
			return project;
		}),

	create: os
		.input(newProjectSchema)
		.handler(({ input }) => ProjectService.createProject(input)),

	update: os
		.input(
			z.object({
				id: z.string().uuid(),
				data: updateProjectSchema,
			}),
		)
		.handler(async ({ input }) => {
			const updated = await ProjectService.updateProject(input.id, input.data);
			if (!updated) {
				throw new Error(`Project not found: ${input.id}`);
			}
			return updated;
		}),

	delete: os
		.input(z.object({ id: z.string().uuid() }))
		.handler(({ input }) => ProjectService.deleteProject(input.id)),

	// Media association
	listForMedia: os
		.input(z.object({ mediaId: z.string().uuid() }))
		.handler(({ input }) => ProjectService.getProjectsForMedia(input.mediaId)),

	addToMedia: os
		.input(
			z.object({
				mediaId: z.string().uuid(),
				projectId: z.string().uuid(),
			}),
		)
		.handler(({ input }) =>
			ProjectService.addProjectToMedia(input.mediaId, input.projectId),
		),

	removeFromMedia: os
		.input(
			z.object({
				mediaId: z.string().uuid(),
				projectId: z.string().uuid(),
			}),
		)
		.handler(({ input }) =>
			ProjectService.removeProjectFromMedia(input.mediaId, input.projectId),
		),
};
