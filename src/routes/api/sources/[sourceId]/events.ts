import type { APIEvent } from "@solidjs/start/server";
import type { UUID } from "~/domain/shared/types";
import { startSseMonitoring } from "~/infrastructure/api-clients/events";

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
