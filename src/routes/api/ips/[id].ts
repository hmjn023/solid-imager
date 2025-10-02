import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { deleteIp, getIpById, updateIp } from "~/lib/api/ips";

// パスパラメータ 'id' のスキーマ
const IdParamSchema = z.object({
  id: z.string().transform(Number), // URLからの文字列IDを数値に変換します。
});

// PUTリクエストボディのスキーマ
const UpdateIpBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
});

/**
 * IPの詳細を取得します。
 *
 * @param param0 {id: number}
 * @returns IP詳細
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
  const ip = await getIpById(id);
  return ip;
}

/**
 * IPを更新します。
 *
 * @param param0 {id: number}
 * @returns 更新されたIP
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
  const parsedBody = UpdateIpBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return new Response(JSON.stringify({ errors: parsedBody.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { name, description } = parsedBody.data;

  const updatedIp = await updateIp(id, name, description);
  return updatedIp;
}

/**
 * IPを削除します。
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
  const result = await deleteIp(id);
  return result;
}
