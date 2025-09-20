import type { APIEvent } from "@solidjs/start/server";
import { createCategory, getCategories } from "~/lib/api/categories";

/**
 *
 * @returns すべてのカテゴリ
 */

export async function GET() {
	const categories = await getCategories();
	return categories;
}

/**
 * カテゴリを作成します。
 *
 * @returns 作成されたカテゴリ
 */
export async function POST({ request }: APIEvent) {
	const { name, description, color, parentId } = await request.json();
	const newCategory = await createCategory(name, description, color, parentId);
	return newCategory;
}
