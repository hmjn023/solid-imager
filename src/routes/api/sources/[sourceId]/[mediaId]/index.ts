import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import type { UUID } from "~/domain/shared/types";
import {
	getMediaDetails,
	updateMedia,
} from "~/infrastructure/api-clients/media";

// パスパラメータのスキーマ
const MediaParamsSchema = z.object({
	sourceId: z.string().uuid(),
	mediaId: z.string().uuid(),
});

// PUTリクエストボディのスキーマ（例、必要に応じて調整）
const UpdateMediaBodySchema = z.object({
	description: z.string().optional(),
	sourceUrl: z.string().url().optional(),
	// 更新可能な他のフィールドを追加
});

/**
 *
 * @param param0 {sourceId: UUID, mediaId: UUID}
 * @returns メディア
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

	const media = await getMediaDetails(sourceId as UUID, mediaId as UUID); // 現時点ではgetMediaDetailsを再利用しています。
	return media;
}

/**
 * 特定メディア情報更新
 * @param param0 {sourceId: UUID, mediaId: UUID}
 * @returns 更新結果
 */
export async function PUT({ params, request }: APIEvent) {
	const parsedParams = MediaParamsSchema.safeParse(params);
	if (!parsedParams.success) {
		return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}
	const { sourceId, mediaId } = parsedParams.data;

	const body = await request.json();
	const parsedBody = UpdateMediaBodySchema.safeParse(body);
	if (!parsedBody.success) {
		return new Response(JSON.stringify({ errors: parsedBody.error.issues }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}
	const data = parsedBody.data;

	const result = await updateMedia(sourceId as UUID, mediaId as UUID, data);
	return result;
}
