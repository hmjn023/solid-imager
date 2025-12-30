import type { APIEvent } from "@solidjs/start/server";
import { ZodError, z } from "zod";
import { ProjectService } from "~/application/services/project-service";
import { NotFoundError } from "~/infrastructure/db/errors";

const MediaParamsSchema = z.object({
  mediaSourceId: z.uuid({ version: "v4" }),
  mediaId: z.uuid({ version: "v4" }),
});

const ProjectBodySchema = z.object({
  projectId: z.string().uuid(),
});

/**
 * @swagger
 * /api/sources/{mediaSourceId}/{mediaId}/projects:
 *   get:
 *     summary: Retrieve projects associated with a media
 *     description: Fetches a list of projects linked to a specific media file.
 *     tags:
 *       - Media
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source.
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media file.
 *     responses:
 *       200:
 *         description: A list of projects associated with the media.
 *       400:
 *         description: Invalid source ID or media ID supplied.
 *       404:
 *         description: Media not found.
 *       500:
 *         description: Internal server error.
 */
export async function GET({ params }: APIEvent) {
  try {
    const { mediaId } = MediaParamsSchema.parse(params);
    const projects = await ProjectService.getProjectsForMedia(mediaId);
    return new Response(JSON.stringify(projects), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * @swagger
 * /api/sources/{mediaSourceId}/{mediaId}/projects:
 *   post:
 *     summary: Add a project to a media
 *     description: Associates a project with a specific media file.
 *     tags:
 *       - Media
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source.
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media file.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               projectId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Project added to media.
 *       400:
 *         description: Invalid data supplied.
 *       500:
 *         description: Internal server error.
 */
export async function POST({ params, request }: APIEvent) {
  try {
    const { mediaId } = MediaParamsSchema.parse(params);
    const body = await request.json();
    const { projectId } = ProjectBodySchema.parse(body);

    const result = await ProjectService.addProjectToMedia(mediaId, projectId);
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * @swagger
 * /api/sources/{mediaSourceId}/{mediaId}/projects:
 *   delete:
 *     summary: Remove a project from a media
 *     description: Removes the association between a project and a specific media file.
 *     tags:
 *       - Media
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source.
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media file.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               projectId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Project removed from media.
 *       400:
 *         description: Invalid data supplied.
 *       404:
 *         description: Association not found.
 *       500:
 *         description: Internal server error.
 */
export async function DELETE({ params, request }: APIEvent) {
  try {
    const { mediaId } = MediaParamsSchema.parse(params);
    const body = await request.json();
    const { projectId } = ProjectBodySchema.parse(body);

    const result = await ProjectService.removeProjectFromMedia(
      mediaId,
      projectId
    );
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (error instanceof NotFoundError) {
      return new Response(JSON.stringify({ error: "Association not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
