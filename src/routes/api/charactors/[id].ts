import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import {
  deleteCharacter,
  getCharacterById,
  updateCharacter,
} from "~/lib/api/characters";

// パスパラメータ 'id' のスキーマ
const IdParamSchema = z.object({
  id: z.string().transform(Number), // URLからの文字列IDを数値に変換します。
});

// PUTリクエストボディのスキーマ
const UpdateCharacterBodySchema = z.object({
  name: z.string().optional(),
  ipId: z.number().optional(),
  description: z.string().optional(),
});

/**
 * キャラクターの詳細を取得します。
 *
 * @param param0 {id: number}
 * @returns キャラクター詳細
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
  const character = await getCharacterById(id);
  return character;
}

/**
 * キャラクターを更新します。
 *
 * @param param0 {id: number}
 * @returns 更新されたキャラクター
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
  const parsedBody = UpdateCharacterBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return new Response(JSON.stringify({ errors: parsedBody.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { name, ipId, description } = parsedBody.data;

  const updatedCharacter = await updateCharacter(id, { name, ipId, description });
  return updatedCharacter;
}

/**
 * キャラクターを削除します。
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
  const result = await deleteCharacter(id);
  return result;
}
