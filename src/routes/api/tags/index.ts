import type { APIEvent } from "@solidjs/start/server";
import { createTag, getTags } from "~/infrastructure/api-clients/tags";

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
  const tags = await getTags();
  return tags;
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
  const data = await request.json();
  const newTag = await createTag(data);
  return newTag;
}
