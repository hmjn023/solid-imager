import type { APIEvent } from "@solidjs/start/server";
import { ZodError, z } from "zod";
import { ProjectService } from "~/application/services/project-service";
import { ResourceNotFoundError } from "~/domain/errors";
import { updateProjectSchema } from "~/domain/projects/schemas";
import { logger } from "~/infrastructure/logger";

// Schema for 'id' path parameter
const IdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     summary: Retrieve a specific Project
 *     description: Fetches details of a Project by its ID.
 *     tags:
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the Project to retrieve.
 *     responses:
 *       200:
 *         description: Details of the Project.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       400:
 *         description: Invalid ID supplied.
 *       404:
 *         description: Project not found.
 *       500:
 *         description: Internal server error.
 */
export async function GET({ params }: APIEvent) {
  try {
    const parsedParams = IdParamSchema.parse(params);
    const { id } = parsedParams;
    const project = await ProjectService.getProjectDetails(id);
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(project), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn(
        { err: error, projectId: params.id },
        "Invalid project ID parameter"
      );
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    logger.error(
      { err: error, projectId: params.id },
      "Failed to fetch project"
    );
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * @swagger
 * /api/projects/{id}:
 *   patch:
 *     summary: Update a specific Project
 *     description: Updates an existing Project with the provided data.
 *     tags:
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the Project to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProject'
 *     responses:
 *       200:
 *         description: The updated Project.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       400:
 *         description: Invalid ID or invalid input.
 *       404:
 *         description: Project not found.
 *       500:
 *         description: Internal server error.
 */
export async function PATCH({ params, request }: APIEvent) {
  try {
    const parsedParams = IdParamSchema.parse(params);
    const { id } = parsedParams;

    const body = await request.json();
    const validatedBody = updateProjectSchema.parse(body);

    const updatedProject = await ProjectService.updateProject(
      id,
      validatedBody
    );
    return new Response(JSON.stringify(updatedProject), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn(
        { err: error, projectId: params.id },
        "Invalid project update request"
      );
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (error instanceof ResourceNotFoundError) {
      logger.warn(
        { err: error, projectId: params.id },
        "Project not found for update"
      );
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    logger.error(
      { err: error, projectId: params.id },
      "Failed to update project"
    );
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * @swagger
 * /api/projects/{id}:
 *   delete:
 *     summary: Delete a specific Project
 *     description: Deletes a Project by its ID.
 *     tags:
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the Project to delete.
 *     responses:
 *       200:
 *         description: Project successfully deleted.
 *       400:
 *         description: Invalid ID supplied.
 *       404:
 *         description: Project not found.
 *       500:
 *         description: Internal server error.
 */
export async function DELETE({ params }: APIEvent) {
  try {
    const parsedParams = IdParamSchema.parse(params);
    const { id } = parsedParams;
    const result = await ProjectService.deleteProject(id);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn(
        { err: error, projectId: params.id },
        "Invalid project ID for deletion"
      );
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (error instanceof ResourceNotFoundError) {
      logger.warn(
        { err: error, projectId: params.id },
        "Project not found for deletion"
      );
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    logger.error(
      { err: error, projectId: params.id },
      "Failed to delete project"
    );
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
