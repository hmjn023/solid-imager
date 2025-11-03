import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import {
  deleteCategory,
  getCategoryById,
  updateCategory,
} from "~/infrastructure/api-clients/categories";

// パスパラメータ 'id' のスキーマ
const IdParamSchema = z.object({
  id: z.string().transform(Number), // URLからの文字列IDを数値に変換します。
});
export type IdParam = z.infer<typeof IdParamSchema>;

// PUTリクエストボディのスキーマ
const UpdateCategoryBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  parentId: z.number().optional(),
});
export type UpdateCategoryBody = z.infer<typeof UpdateCategoryBodySchema>;

/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     summary: Retrieve a specific category
 *     description: Fetches details of a category by its ID.
 *     tags:
 *       - Categories
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Numeric ID of the category to retrieve.
 *     responses:
 *       200:
 *         description: Details of the category.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       400:
 *         description: Invalid ID supplied.
 *       404:
 *         description: Category not found.
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
  const category = await getCategoryById(id);
  return category;
}

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Update a specific category
 *     description: Updates an existing category with the provided data.
 *     tags:
 *       - Categories
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Numeric ID of the category to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCategory'
 *     responses:
 *       200:
 *         description: The updated category.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       400:
 *         description: Invalid ID or invalid input.
 *       404:
 *         description: Category not found.
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
  const parsedBody = UpdateCategoryBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return new Response(JSON.stringify({ errors: parsedBody.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { name, description, color, parentId } = parsedBody.data;

  const updatedCategory = await updateCategory(id, {
    name,
    description,
    color,
    parentId,
  });
  return updatedCategory;
}

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Delete a specific category
 *     description: Deletes a category by its ID.
 *     tags:
 *       - Categories
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Numeric ID of the category to delete.
 *     responses:
 *       200:
 *         description: Category successfully deleted.
 *       400:
 *         description: Invalid ID supplied.
 *       404:
 *         description: Category not found.
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
  const result = await deleteCategory(id);
  return result;
}
