import type { APIEvent } from "@solidjs/start/server";
import { searchMedia } from "~/lib/api/media";
import type { UUID } from "~/lib/utils";

/**
 * 特定のメディアソース内で、タグ、メタデータ、カテゴリ、IP、キャラクターなどの情報に基づいてメディアを検索します。
 * 検索結果はページネーションされます。
 *
 * @param param0 {sourceId: UUID}
 * @returns 検索条件に一致するメディアのリストとページネーション情報
 */
export async function GET({ params, request }: APIEvent) {
	const sourceId = params.sourceId as UUID;
	const url = new URL(request.url);
	const queryParams = Object.fromEntries(url.searchParams.entries());
	const result = await searchMedia(sourceId, queryParams);
	return result;
}
