import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { deleteTag, getTagById, updateTag } from "~/lib/api/tags";

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
 * タグの詳細を取得します。
 *
 * @param param0 {id: number}
 * @returns タグ詳細
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
 * タグを更新します。
 *
 * @param param0 {id: number}
 * @returns 更新されたタグ
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

  const updatedTag = await updateTag(id, name, description, attribute, color);
  return updatedTag;
}

/**
 * タグを削除します。
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
  const result = await deleteTag(id);
  return result;
}
