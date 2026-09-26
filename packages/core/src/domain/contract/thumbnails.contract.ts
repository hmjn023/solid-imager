import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	generateThumbnailsRequestSchema,
	generateThumbnailsResponseSchema,
} from "../thumbnails/schemas";

export const thumbnailsContract = {
	generate: oc
		.route({
			tags: ["Thumbnails"],
			summary: "サムネイル生成",
			description:
				"指定したメディアソースやメディアを対象にサムネイルを生成し、生成結果を返します。",
		})
		.input(generateThumbnailsRequestSchema)
		.output(generateThumbnailsResponseSchema),

	clear: oc
		.route({
			tags: ["Thumbnails"],
			summary: "サムネイルキャッシュ削除",
			description: "指定したメディアソースのサムネイルキャッシュを削除します。",
		})
		.input(z.object({ sourceId: z.string().uuid() })),
};
