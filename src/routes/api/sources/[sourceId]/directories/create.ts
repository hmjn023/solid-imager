import type { APIEvent } from "@solidjs/start/server";
import type { UUID } from "~/domain/shared/types";
import { createDirectory } from "~/infrastructure/api-clients/directories";

/**
 * ディレクトリを作成します。
 *
 * @param param0 {sourceId: UUID}
 * @returns ディレクトリ作成結果
 */
export async function POST({ params, request }: APIEvent) {
  const sourceId = params.sourceId as UUID;
  const { path, name } = await request.json(); // パスと名前がボディに含まれていると仮定します。
  const result = await createDirectory(sourceId, path, name);
  return result;
}
