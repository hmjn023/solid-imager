import type { APIEvent } from "@solidjs/start/server";
import type { UUID } from "~/domain/shared/types";
import { deleteDirectory } from "~/infrastructure/api-clients/directories";

/**
 * ディレクトリを削除します。
 *
 * @param param0 {sourceId: UUID, directories: path}
 * @returns ディレクトリ削除結果
 */
export async function DELETE({ params, request }: APIEvent) {
	const sourceId = params.sourceId as UUID;
	const { path } = await request.json(); // パスがボディに含まれていると仮定します。
	const result = await deleteDirectory(sourceId, path);
	return result;
}
