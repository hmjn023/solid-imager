import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import {
  deleteTag,
  getTagById,
  updateTag,
} from "~/infrastructure/api-clients/tags";

// パスパラメータ 'id' のスキーマ
const IdParamSchema = z.object({
  id: z.string().transform(Number), // URLからの文字列IDを数値に変換します。
});

// PUTリクエストボディのスキーマ
const UpdateTagBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  attribute: z.string().optional(),
  color: z.string().optional(),
});

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
 *           type: integer
 *         description: Numeric ID of the tag to retrieve.
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
  const parsedParams = IdParamSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { id } = parsedParams.data;
  const tag = await getTagById(id);
  return tag;
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
 *           type: integer
 *         description: Numeric ID of the tag to update.
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
  const parsedParams = IdParamSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { id } = parsedParams.data;

  const body = await request.json();
  const parsedBody = UpdateTagBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return new Response(JSON.stringify({ errors: parsedBody.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { name, description, attribute, color } = parsedBody.data;

  const updatedTag = await updateTag(id, {
    name,
    description,
    attribute,
    color,
  });
  return updatedTag;
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
 *           type: integer
 *         description: Numeric ID of the tag to delete.
 *     responses:
 *       200:
 *         description: Tag successfully deleted.
 *       400:
 *         description: Invalid ID supplied.
 *       404:
 *         description: Tag not found.
 *       500:
 *         description: Internal server error.
 */
export async function DELETE({ params }: APIEvent) {
  const parsedParams = IdParamSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { id } = parsedParams.data;
  const result = await deleteTag(id);
  return result;
}
