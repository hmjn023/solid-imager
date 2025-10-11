import type { APIEvent } from "@solidjs/start/server";
import type { UUID } from "~/domain/shared/types";
import { getDirectoryListing } from "~/infrastructure/api-clients/directories";

/**
 *
 * @param param0 {sourceId: UUID}
 * @returns メディアソース下のディレクトリツリー(?、まだ考えきれてない)
 */
export async function GET({ params, request }: APIEvent) {
  const sourceId = params.sourceId as UUID;
  const url = new URL(request.url);
  const path = url.searchParams.get("path") || undefined; // ?path=parent を処理します。
  const listing = await getDirectoryListing(sourceId, path);
  return listing;
}
