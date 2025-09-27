import type { APIEvent } from "@solidjs/start/server";
import { deleteDirectory } from "~/lib/api/directories";
import type { UUID } from "~/lib/utils";

/**
 * ディレクトリを削除します。
 *
 * @param param0 {sourceId: UUID, directories: path}
 * @returns ディレクトリ削除結果
 */
export async function DELETE({ params, request }: APIEvent) {
  const sourceId = params.sourceId as UUID;
  const { path } = await request.json(); // Assuming path is in body
  const result = await deleteDirectory(sourceId, path);
  return result;
}
