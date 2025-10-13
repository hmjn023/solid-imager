import type { APIEvent } from "@solidjs/start/server";
import type { UUID } from "~/domain/shared/types";
import { renameDirectory } from "~/infrastructure/api-clients/directories";

/**
 * ディレクトリ名を変更します。
 *
 * @param param0 {sourceId: UUID, directories: path}
 * @returns ディレクトリ名変更結果
 */
export async function PUT({ params, request }: APIEvent) {
  const sourceId = params.sourceId as UUID;
  const { oldPath, newPath } = await request.json(); // oldPathとnewPathがボディに含まれていると仮定します。
  const result = await renameDirectory(sourceId, oldPath, newPath);
  return result;
}
