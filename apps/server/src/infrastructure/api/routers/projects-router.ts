import { implement } from "@orpc/server";
import { projectsContract } from "@solid-imager/core/domain/contract/projects.contract";
import { ProjectService } from "~/infrastructure/services/project-service";
import { getProjectMediaCounts } from "./entity-media-counts";

/**
 * Projects Router Implementation
 */
const os = implement(projectsContract);

export const projectsRouter = os.router({
	list: os.list.handler(async () => {
		const projects = await ProjectService.getAllProjects();
		const mediaCounts = await getProjectMediaCounts(
			projects.map((project) => project.id),
		);
		return projects.map((project) => ({
			...project,
			mediaCount: mediaCounts.get(project.id) ?? 0,
		}));
	}),

	get: os.get.handler(async ({ input }) => {
		const project = await ProjectService.getProjectDetails(input.id);
		if (!project) {
			throw new Error(`Project not found: ${input.id}`);
		}
		return project;
	}),

	create: os.create.handler(({ input }) => ProjectService.createProject(input)),

	update: os.update.handler(async ({ input }) => {
		const updated = await ProjectService.updateProject(input.id, input.data);
		if (!updated) {
			throw new Error(`Project not found: ${input.id}`);
		}
		return updated;
	}),

	delete: os.delete.handler(({ input }) =>
		ProjectService.deleteProject(input.id),
	),

	// Media association
	listForMedia: os.listForMedia.handler(({ input }) =>
		ProjectService.getProjectsForMedia(input.mediaId),
	),

	addToMedia: os.addToMedia.handler(({ input }) =>
		ProjectService.addProjectToMedia(input.mediaId, input.projectId),
	),

	removeFromMedia: os.removeFromMedia.handler(({ input }) =>
		ProjectService.removeProjectFromMedia(input.mediaId, input.projectId),
	),
});
