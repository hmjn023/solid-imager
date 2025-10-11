import type { APIEvent } from "@solidjs/start/server";
import type { UUID } from "~/domain/shared/types";
import { searchMedia } from "~/infrastructure/api-clients/media";

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
