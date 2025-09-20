import type { APIEvent } from "@solidjs/start/server";
import { renameDirectory } from "~/lib/api/directories";
import type { UUID } from "~/lib/utils";

/**
 * ディレクトリ名を変更します。
 *
 * @param param0 {sourceId: UUID, directories: path}
 * @returns ディレクトリ名変更結果
 */
export async function PUT({ params, request }: APIEvent) {
	const sourceId = params.sourceId as UUID;
	const { oldPath, newPath } = await request.json(); // Assuming oldPath and newPath are in body
	const result = await renameDirectory(sourceId, oldPath, newPath);
	return result;
}
