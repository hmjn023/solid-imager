import type { APIEvent } from "@solidjs/start/server";
import { ZodError } from "zod";
import { TagService } from "~/application/services/tag-service";
import { newTagSchema } from "~/domain/tags/schemas";
import { logger } from "~/infrastructure/logger";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const _HTTP_BAD_REQUEST = 400;
const _HTTP_INTERNAL_SERVER_ERROR = 500;

/**
 * @swagger
 * /api/tags:
 *   get:
 *     summary: Retrieve all tags
 *     description: Fetches a list of all configured tags.
 *     tags:
 *       - Tags
 *     responses:
 *       200:
 *         description: A list of tags.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tag'
 *       500:
 *         description: Internal server error.
 */
export async function GET() {
  try {
    const tags = await TagService.getAllTags();
    return new Response(JSON.stringify(tags), {
      status: HTTP_OK,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch tags");
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * @swagger
 * /api/tags:
 *   post:
 *     summary: Create a new tag
 *     description: Creates a new tag with the provided data.
 *     tags:
 *       - Tags
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewTag'
 *     responses:
 *       201:
 *         description: The created tag.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tag'
 *       400:
 *         description: Invalid input.
 *       500:
 *         description: Internal server error.
 */
export async function POST({ request }: APIEvent) {
  try {
    const data = await request.json();
    const validatedData = newTagSchema.parse(data);

    const newTag = await TagService.createTag(validatedData);

    return new Response(JSON.stringify(newTag), {
      status: HTTP_CREATED,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ err: error }, "Invalid tag creation request");
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    logger.error({ err: error }, "Failed to create tag");
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
