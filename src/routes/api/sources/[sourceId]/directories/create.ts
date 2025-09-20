import type { APIEvent } from "@solidjs/start/server";
import { createDirectory } from "~/lib/api/directories";
import type { UUID } from "~/lib/utils";

/**
 * ディレクトリを作成します。
 *
 * @param param0 {sourceId: UUID}
 * @returns ディレクトリ作成結果
 */
export async function POST({ params, request }: APIEvent) {
	const sourceId = params.sourceId as UUID;
	const { path, name } = await request.json(); // Assuming path and name are in body
	const result = await createDirectory(sourceId, path, name);
	return result;
}
