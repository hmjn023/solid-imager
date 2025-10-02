import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import {
  deleteCategory,
  getCategoryById,
  updateCategory,
} from "~/lib/api/categories";

// パスパラメータ 'id' のスキーマ
const IdParamSchema = z.object({
  id: z.string().transform(Number), // URLからの文字列IDを数値に変換します。
});

// PUTリクエストボディのスキーマ
const UpdateCategoryBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  parentId: z.number().optional(),
});

/**
 * カテゴリの詳細を取得します。
 *
 * @param param0 {id: number}
 * @returns カテゴリ詳細
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
 * カテゴリを更新します。
 *
 * @param param0 {id: number}
 * @returns 更新されたカテゴリ
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

  const updatedCategory = await updateCategory(
    id,
    name,
    description,
    color,
    parentId
  );
  return updatedCategory;
}

/**
 * カテゴリを削除します。
 *
 * @param param0 {id: number}
 * @returns 削除結果
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
