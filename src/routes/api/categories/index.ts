import type { APIEvent } from "@solidjs/start/server";
import { ZodError } from "zod";
import { CategoryService } from "~/application/services/category-service";
import { CategoryServiceV2 } from "~/application/services/category-service-v2";
import { newCategorySchema } from "~/domain/categories/schemas";
import { logger } from "~/infrastructure/logger";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const _HTTP_BAD_REQUEST = 400;
const _HTTP_INTERNAL_SERVER_ERROR = 500;

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Retrieve all categories
 *     description: Fetches a list of all configured categories.
 *     tags:
 *       - Categories
 *     responses:
 *       200:
 *         description: A list of categories.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 *       500:
 *         description: Internal server error.
 */
export async function GET() {
  try {
    const useV2 = process.env.USE_REPO_V2 === "true";
    const service = useV2 ? CategoryServiceV2 : CategoryService;
    const categories = await service.getAllCategories();
    return new Response(JSON.stringify(categories), {
      status: HTTP_OK,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch categories");
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Create a new category
 *     description: Creates a new category with the provided data.
 *     tags:
 *       - Categories
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewCategory'
 *     responses:
 *       201:
 *         description: The created category.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       400:
 *         description: Invalid input.
 *       500:
 *         description: Internal server error.
 */
export async function POST({ request }: APIEvent) {
  try {
    const data = await request.json();
    const validatedData = newCategorySchema.parse(data);

    const useV2 = process.env.USE_REPO_V2 === "true";
    const service = useV2 ? CategoryServiceV2 : CategoryService;
    const newCategory = await service.createCategory(validatedData);

    return new Response(JSON.stringify(newCategory), {
      status: HTTP_CREATED,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ err: error }, "Invalid category creation request");
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    logger.error({ err: error }, "Failed to create category");
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
