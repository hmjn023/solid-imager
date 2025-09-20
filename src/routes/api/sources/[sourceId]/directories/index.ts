import type { APIEvent } from "@solidjs/start/server";
import { getDirectoryListing } from "~/lib/api/directories";
import type { UUID } from "~/lib/utils";

/**
 *
 * @param param0 {sourceId: UUID}
 * @returns メディアソース下のディレクトリツリー(?、まだ考えきれてない)
 */
export async function GET({ params, request }: APIEvent) {
	const sourceId = params.sourceId as UUID;
	const url = new URL(request.url);
	const path = url.searchParams.get("path") || undefined; // Handle ?path=parent
	const listing = await getDirectoryListing(sourceId, path);
	return listing;
}
