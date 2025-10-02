import type { APIEvent } from "@solidjs/start/server";
import { getDirectoryListing } from "~/lib/api/directories";
import type { UUID } from "~/lib/utils";

/**
 *
 * @param param0 {sourceId: UUID, directories: path}
 * @returns 特定のディレクトリ下のすべてのメディアとディレクトリ
 */
export async function GET({ params }: APIEvent) {
  const sourceId = params.sourceId as UUID;
  const directoriesPath = params.directories.join("/"); // パスを再構築します。
  const listing = await getDirectoryListing(sourceId, directoriesPath);
  return listing;
}
