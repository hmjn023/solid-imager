import type { APIEvent } from "@solidjs/start/server";
import { startSseMonitoring } from "~/lib/api/events";
import type { UUID } from "~/lib/utils";

/**
 * リアルタイム更新のためのSSE監視を開始します。
 *
 * @param param0 {sourceId: UUID}
 * @returns SSEストリーム
 */
export async function GET({ params }: APIEvent) {
  const sourceId = params.sourceId as UUID;
  const result = await startSseMonitoring(sourceId);
  return result;
}
