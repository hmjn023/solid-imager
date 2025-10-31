import type { APIEvent } from "@solidjs/start/server";
import {
  createCategory,
  getCategories,
} from "~/infrastructure/api-clients/categories";

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
  const categories = await getCategories();
  return categories;
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
  const data = await request.json();
  const newCategory = await createCategory(data);
  return newCategory;
}
