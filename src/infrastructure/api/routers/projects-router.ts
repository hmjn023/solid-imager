import { os } from "@orpc/server";
import { z } from "zod";
import { ProjectService } from "~/application/services/project-service";
import {
  newProjectSchema,
  updateProjectSchema,
} from "~/domain/projects/schemas";

/**
 * Projects Router Implementation
 */
export const projectsRouter = {
  list: os.handler(() => ProjectService.getAllProjects()),

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
      })
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
      })
    )
    .handler(({ input }) =>
      ProjectService.addProjectToMedia(input.mediaId, input.projectId)
    ),

  removeFromMedia: os
    .input(
      z.object({
        mediaId: z.string().uuid(),
        projectId: z.string().uuid(),
      })
    )
    .handler(({ input }) =>
      ProjectService.removeProjectFromMedia(input.mediaId, input.projectId)
    ),
};
