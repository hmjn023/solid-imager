import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import type { UUID } from "~/domain/shared/types";
import { getMediaTags } from "~/infrastructure/api-clients/media";

// パスパラメータのスキーマ
const MediaParamsSchema = z.object({
	sourceId: z.string().uuid(),
	mediaId: z.string().uuid(),
});

/**
 *
 * @param param0 {sourceId: UUID, mediaId: UUID}
 * @returns メディアのタグ
 */
export async function GET({ params }: APIEvent) {
	const parsedParams = MediaParamsSchema.safeParse(params);
	if (!parsedParams.success) {
		return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}
	const { sourceId, mediaId } = parsedParams.data;

	const tags = await getMediaTags(sourceId as UUID, mediaId as UUID);
	return tags;
}
