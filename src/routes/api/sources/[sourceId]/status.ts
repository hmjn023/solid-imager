import type { APIEvent } from "@solidjs/start/server";
import type { UUID } from "~/domain/shared/types";
import { getMediaSourceStatus } from "~/infrastructure/api-clients/sources";

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
