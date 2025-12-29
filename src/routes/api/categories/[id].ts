import type { APIEvent } from "@solidjs/start/server";
import { ZodError, z } from "zod";
import { CategoryService } from "~/application/services/category-service";
import { updateCategorySchema } from "~/domain/categories/schemas";
import { logger } from "~/infrastructure/logger";

const HTTP_OK = 200;
const _HTTP_BAD_REQUEST = 400;
const _HTTP_NOT_FOUND = 404;
const _HTTP_INTERNAL_SERVER_ERROR = 500;

// パスパラメータ 'id' のスキーマ
const IdParamSchema = z.object({
  id: z.string().uuid(), // UUID v4 を想定します。
});
export type IdParam = z.infer<typeof IdParamSchema>;

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
 *           type: string
 *           format: uuid
 *         description: UUID of the category to retrieve.
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
  try {
    const parsedParams = IdParamSchema.parse(params);
    const { id } = parsedParams;

    const category = await CategoryService.getCategoryDetails(id);

    return new Response(JSON.stringify(category), {
      status: HTTP_OK,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn(
        { err: error, categoryId: params.id },
        "Invalid category ID parameter"
      );
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    logger.error(
      { err: error, categoryId: params.id },
      "Failed to fetch category"
    );
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
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
 *           type: string
 *           format: uuid
 *         description: UUID of the category to update.
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
  try {
    const parsedParams = IdParamSchema.parse(params);
    const { id } = parsedParams;

    const body = await request.json();
    const validatedBody = updateCategorySchema.parse(body);

    const updatedCategory = await CategoryService.updateCategory(
      id,
      validatedBody
    );

    return new Response(JSON.stringify(updatedCategory), {
      status: HTTP_OK,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn(
        { err: error, categoryId: params.id },
        "Invalid category update request"
      );
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    logger.error(
      { err: error, categoryId: params.id },
      "Failed to update category"
    );
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
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
 *           type: string
 *           format: uuid
 *         description: UUID of the category to delete.
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
  try {
    const parsedParams = IdParamSchema.parse(params);
    const { id } = parsedParams;

    const result = await CategoryService.deleteCategory(id);

    return new Response(JSON.stringify(result), {
      status: HTTP_OK,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn(
        { err: error, categoryId: params.id },
        "Invalid category ID for deletion"
      );
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    logger.error(
      { err: error, categoryId: params.id },
      "Failed to delete category"
    );
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
