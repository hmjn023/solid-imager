import type { APIEvent } from "@solidjs/start/server";
import { ZodError, z } from "zod";
import { TagService } from "~/application/services/tag-service";
import { updateTagSchema } from "~/domain/tags/schemas";
import { logger } from "~/infrastructure/logger";

const HTTP_OK = 200;
const HTTP_NO_CONTENT = 204;
const _HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const _HTTP_INTERNAL_SERVER_ERROR = 500;

// パスパラメータ 'id' のスキーマ
const IdParamSchema = z.object({
  id: z.string().uuid(), // UUID v4 を想定します。
});
export type IdParam = z.infer<typeof IdParamSchema>;

/**
 * @swagger
 * /api/tags/{id}:
 *   get:
 *     summary: Retrieve a specific tag
 *     description: Fetches details of a tag by its ID.
 *     tags:
 *       - Tags
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the tag to retrieve.
 *     responses:
 *       200:
 *         description: Details of the tag.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tag'
 *       400:
 *         description: Invalid ID supplied.
 *       404:
 *         description: Tag not found.
 *       500:
 *         description: Internal server error.
 */
export async function GET({ params }: APIEvent) {
  try {
    const parsedParams = IdParamSchema.parse(params);
    const { id } = parsedParams;

    const tag = await TagService.getTagById(id);

    if (!tag) {
      return new Response(JSON.stringify({ error: "Tag not found" }), {
        status: HTTP_NOT_FOUND,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(tag), {
      status: HTTP_OK,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ err: error, tagId: params.id }, "Invalid tag ID parameter");
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    logger.error({ err: error, tagId: params.id }, "Failed to fetch tag");
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * @swagger
 * /api/tags/{id}:
 *   put:
 *     summary: Update a specific tag
 *     description: Updates an existing tag with the provided data.
 *     tags:
 *       - Tags
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the tag to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateTag'
 *     responses:
 *       200:
 *         description: The updated tag.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tag'
 *       400:
 *         description: Invalid ID or invalid input.
 *       404:
 *         description: Tag not found.
 *       500:
 *         description: Internal server error.
 */
export async function PUT({ params, request }: APIEvent) {
  try {
    const parsedParams = IdParamSchema.parse(params);
    const { id } = parsedParams;

    const body = await request.json();
    const validatedBody = updateTagSchema.parse(body);

    const updatedTag = await TagService.updateTag(id, validatedBody);

    if (!updatedTag) {
      return new Response(JSON.stringify({ error: "Tag not found" }), {
        status: HTTP_NOT_FOUND,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(updatedTag), {
      status: HTTP_OK,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn(
        { err: error, tagId: params.id },
        "Invalid tag update request"
      );
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (error instanceof Error) {
      logger.error({ err: error, tagId: params.id }, "Failed to update tag");
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    logger.error({ err: error, tagId: params.id }, "Failed to update tag");
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * @swagger
 * /api/tags/{id}:
 *   delete:
 *     summary: Delete a specific tag
 *     description: Deletes a tag by its ID.
 *     tags:
 *       - Tags
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the tag to delete.
 *     responses:
 *       204:
 *         description: Tag successfully deleted.
 *       400:
 *         description: Invalid ID supplied or tag is in use.
 *       404:
 *         description: Tag not found.
 *       500:
 *         description: Internal server error.
 */
export async function DELETE({ params }: APIEvent) {
  try {
    const parsedParams = IdParamSchema.parse(params);
    const { id } = parsedParams;

    const tag = await TagService.getTagById(id);
    if (!tag) {
      return new Response(JSON.stringify({ error: "Tag not found" }), {
        status: HTTP_NOT_FOUND,
        headers: { "Content-Type": "application/json" },
      });
    }

    await TagService.deleteTag(id);
    return new Response(null, { status: HTTP_NO_CONTENT });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn(
        { err: error, tagId: params.id },
        "Invalid tag ID parameter for deletion"
      );
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (error instanceof Error) {
      logger.error({ err: error, tagId: params.id }, "Failed to delete tag");
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    logger.error({ err: error, tagId: params.id }, "Failed to delete tag");
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
