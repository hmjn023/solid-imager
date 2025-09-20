import type { APIEvent } from "@solidjs/start/server";
import {
	deleteMediaSource,
	getMediaSourceById,
	updateMediaSource,
} from "~/lib/api/sources";
import type { UUID } from "~/lib/utils";

/**
 *
 * @param param0 {sourceId: UUID}
 * @returns 画像ソース内のすべてのメディア
 */
export async function GET({ params }: APIEvent) {
	const sourceId = params.sourceId as UUID;
	const source = await getMediaSourceById(sourceId); // Reusing getMediaSourceById for now
	return source;
}

/**
 * メディアソースを更新します。
 *
 * @param param0 {sourceId: UUID}
 * @returns 更新されたメディアソース
 */
export async function PUT({ params, request }: APIEvent) {
	const sourceId = params.sourceId as UUID;
	const data = await request.json();
	const updatedSource = await updateMediaSource(sourceId, data);
	return updatedSource;
}

/**
 * メディアソースを削除します。
 *
 * @param param0 {sourceId: UUID}
 * @returns 削除結果
 */
export async function DELETE({ params }: APIEvent) {
	const sourceId = params.sourceId as UUID;
	const result = await deleteMediaSource(sourceId);
	return result;
}
