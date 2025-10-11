import type { APIEvent } from "@solidjs/start/server";
import { getMediaSourceStatus } from "~/lib/api/sources";
import type { UUID } from "~/lib/types";

/**
 *
 * @param param0 {sourceId: UUID}
 * @returns メディアソースの状態
 */
export async function GET({ params }: APIEvent) {
  const sourceId = params.sourceId as UUID;
  const status = await getMediaSourceStatus(sourceId);
  return status;
}
