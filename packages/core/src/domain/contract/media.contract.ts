import { openapi } from "@orpc/openapi";
import { oc } from "@orpc/contract";
import { z } from "zod";
import { binaryResponseBody } from "./binary-response";
import { MEDIA_CONTENT_ROUTE, MEDIA_THUMBNAIL_ROUTE } from "./http-paths";
import { omitFromMcp } from "./publication";
import {
	bulkCopyToSourceMediaRequestSchema,
	bulkMediaOperationResultSchema,
	bulkDeleteMediaRequestSchema,
	bulkEditMediaRequestSchema,
	bulkMoveMediaRequestSchema,
	bulkMoveToSourceMediaRequestSchema,
	bulkTagMediaRequestSchema,
	findDuplicatesRequestSchema,
	findDuplicatesResponseSchema,
	mediaActivitySchema,
	mediaDetailsSchema,
	mediaPreferencesPatchSchema,
	mediaSchema,
	mediaLocationSchema,
	mediaSearchRequestSchema,
	mediaSearchResponseSchema,
	relatedMediaRequestSchema,
	relatedMediaResponseSchema,
	similarMediaSearchResponseSchema,
	tagSchema,
	updateMediaRequestSchema,
	updatePositiveMediaTagsSchema,
} from "../media/schemas";
import { uploadResponseSchema } from "../media/upload-schemas";
import { similarMediaRequestSchema } from "../tagging/schemas";
import { semanticSearchRequestSchema } from "../search/embedding";
import { thumbnailSizeSchema } from "../thumbnails/schemas";

import {
	statisticsRequestSchema,
	statisticsResponseSchema,
} from "../media/statistics";

const mediaContentHeadersSchema = z.object({
	"accept-ranges": z.string().optional(),
	"cache-control": z.string().optional(),
	"content-length": z.string().optional(),
	"content-range": z.string().optional(),
	"content-type": z.string().optional(),
});

const thumbnailHeadersSchema = z.object({
	"cache-control": z.string().optional(),
	"content-type": z.string().optional(),
	"x-thumbnail-fallback": z.string().optional(),
});

export const mediaContract = {
	getRelated: oc
		.meta(
			openapi({
				method: "GET",
				path: "/sources/{sourceId}/media/{mediaId}/related",
				tags: ["Media"],
				summary: "関連メディア取得",
				description:
					"保存済み索引から見た目の似た画像・動画を推薦します。動画は代表サムネイルで比較します。同じキャラクター・IPやpositiveタグの希少性に基づく候補は全ソースの画像が対象です。recommendationsは関連度と多様性を考慮した重み付き抽選、itemsは種類別の候補です。limitはおすすめと各種類それぞれの上限です。seedと候補データが同じなら抽選結果を再現できます。閲覧時にAI推論は行いません。",
			}),
		)
		.input(relatedMediaRequestSchema)
		.output(relatedMediaResponseSchema),
	statistics: oc
		.meta(
			openapi({
				method: "POST",
				path: "/media/statistics",
				tags: ["Media"],
				summary: "ライブラリ統計",
				description:
					"現在ライブラリに残るメディアをDB登録日で集計します。累計には表示期間より前の登録分も含みます。作品・キャラクター別の件数はManagerと同じ直接の関連付けを対象とします。",
			}),
		)
		.input(statisticsRequestSchema)
		.output(statisticsResponseSchema),
	updatePreferences: oc
		.meta(
			openapi({
				method: "PATCH",
				path: "/sources/{sourceId}/media/{mediaId}/preferences",
				tags: ["Media"],
				summary: "メディアの評価・お気に入りを更新",
				description:
					"評価は1〜5、0で未評価に戻します。指定した項目だけを更新します。",
			}),
		)
		.input(mediaLocationSchema.extend({ data: mediaPreferencesPatchSchema }))
		.output(mediaActivitySchema),
	recordView: oc
		.meta(
			openapi({
				method: "POST",
				path: "/sources/{sourceId}/media/{mediaId}/views",
				tags: ["Media"],
				summary: "メディアの閲覧を記録",
				description:
					"詳細を開いた際の閲覧を記録します。同じ閲覧IDの再送は1回として扱います。",
			}),
		)
		.input(mediaLocationSchema.extend({ viewId: z.uuid() }))
		.output(mediaActivitySchema),
	searchSemantic: oc
		.meta(
			openapi({
				method: "POST",
				path: "/media/search/semantic",
				tags: ["Media"],
				summary: "自然言語で画像・動画を検索",
				description:
					"EmbeddingGemma 2 の索引を文章で検索します。対象は索引登録済みで更新されていない画像と動画です。動画の索引は代表サムネイル1枚に基づきます。",
			}),
		)
		.input(semanticSearchRequestSchema)
		.output(similarMediaSearchResponseSchema),
	search: oc
		.meta(
			openapi({
				method: "POST",
				path: "/media/search",
				tags: ["Media"],
				summary: "メディア検索",
				description:
					"メディアソースと検索条件を指定してメディアを検索します。タグ、カテゴリ、作品、キャラクターなどの条件や並び順を利用できます。",
			}),
		)
		.input(
			z.object({
				sourceId: z.uuid().nullish(),
				params: mediaSearchRequestSchema,
			}),
		)
		.output(mediaSearchResponseSchema),

	searchSimilar: oc
		.meta(
			openapi({
				method: "POST",
				path: "/media/search/similar",
				tags: ["Media"],
				summary: "類似メディア検索",
				description:
					"指定した基準メディアに視覚的特徴が近いメディアを検索し、類似度順の結果を返します。",
			}),
		)
		.input(similarMediaRequestSchema)
		.output(similarMediaSearchResponseSchema),

	get: oc
		.meta(
			openapi({
				method: "GET",
				path: "/sources/{sourceId}/media/{mediaId}",
				tags: ["Media"],
				summary: "メディア取得",
				description:
					"メディアソースIDとメディアIDで指定したメディアの基本情報を取得します。",
			}),
		)
		.input(mediaLocationSchema)
		.output(mediaSchema),

	getDetails: oc
		.meta(
			openapi({
				method: "GET",
				path: "/sources/{sourceId}/media/{mediaId}/details",
				tags: ["Media"],
				summary: "メディア詳細取得",
				description:
					"指定したメディアの基本情報に加え、タグやカテゴリ、作品、キャラクターなどの関連情報を取得します。",
			}),
		)
		.input(mediaLocationSchema)
		.output(mediaDetailsSchema),

	getContent: oc
		.meta(omitFromMcp)
		.meta(
			openapi({
				method: "GET",
				path: MEDIA_CONTENT_ROUTE,
				tags: ["Media"],
				summary: "メディア原本を取得",
				inputStructure: "detailed",
				outputStructure: "detailed",
				spec: (operation) => {
					const response = operation.responses?.["416"];
					if (response && !("$ref" in response)) {
						response.headers = {
							...response.headers,
							"content-range": {
								description:
									"原本のバイト数を bytes */{length} 形式で返します。",
								schema: { type: "string" },
							},
						};
					}
					return operation;
				},
			}),
		)
		.input(
			z.object({
				params: mediaLocationSchema,
				headers: z
					.object({
						range: z.string().optional(),
						"if-range": z.string().optional(),
					})
					.optional(),
			}),
		)
		.errors({
			RANGE_NOT_SATISFIABLE: { message: "Requested range is not satisfiable" },
		})
		.output(
			z.object({
				status: z.union([z.literal(200), z.literal(206)]),
				headers: mediaContentHeadersSchema,
				body: binaryResponseBody("*/*"),
			}),
		),

	headContent: oc
		.meta(omitFromMcp)
		.meta(
			openapi({
				method: "HEAD",
				path: MEDIA_CONTENT_ROUTE,
				tags: ["Media"],
				summary: "メディア原本のヘッダーを取得",
				outputStructure: "detailed",
				spec: (operation) => {
					const response = operation.responses?.["200"];
					if (response && "content" in response) delete response.content;
					return operation;
				},
			}),
		)
		.input(mediaLocationSchema)
		.output(
			z.object({
				headers: mediaContentHeadersSchema,
				body: z.instanceof(ReadableStream<Uint8Array>),
			}),
		),

	getThumbnail: oc
		.meta(omitFromMcp)
		.meta(
			openapi({
				method: "GET",
				path: MEDIA_THUMBNAIL_ROUTE,
				tags: ["Media"],
				summary: "メディアのサムネイルを取得",
				outputStructure: "detailed",
			}),
		)
		.input(
			mediaLocationSchema.extend({
				size: thumbnailSizeSchema.optional(),
				t: z.string().optional(),
			}),
		)
		.output(
			z.union([
				z.object({
					status: z.literal(200),
					headers: thumbnailHeadersSchema,
					body: binaryResponseBody("image/webp"),
				}),
				z.object({
					status: z.literal(204),
					headers: thumbnailHeadersSchema,
				}),
			]),
		),

	getTags: oc
		.meta(
			openapi({
				method: "GET",
				path: "/sources/{sourceId}/media/{mediaId}/tags",
				tags: ["Media"],
				summary: "メディアタグ一覧取得",
				description:
					"指定したメディアに関連付けられているタグを一覧で取得します。",
			}),
		)
		.input(mediaLocationSchema)
		.output(z.array(tagSchema)),

	update: oc
		.meta(
			openapi({
				method: "PATCH",
				path: "/sources/{sourceId}/media/{mediaId}",
				tags: ["Media"],
				summary: "メディア情報更新",
				description:
					"指定したメディアの説明、カテゴリ、撮影・生成情報などの編集可能なメタデータを更新します。",
			}),
		)
		.input(
			z.object({
				sourceId: z.uuid(),
				mediaId: z.uuid(),
				data: updateMediaRequestSchema,
			}),
		)
		.output(mediaSchema),

	sync: oc
		.meta(
			openapi({
				method: "POST",
				path: "/sources/{sourceId}/media/sync",
				tags: ["Media"],
				summary: "メディア情報の再解析",
				description:
					"指定したメディアのメタデータとタグを再抽出します。複数件は同時実行数を制限して処理し、各メディアの成功・失敗結果を返します。",
			}),
		)
		.input(
			z.object({
				sourceId: z.uuid(),
				mediaIds: z.array(z.uuid()),
			}),
		)
		.output(
			z.object({
				results: z.array(
					z.object({
						id: z.string(),
						success: z.boolean(),
						error: z.string().optional(),
					}),
				),
			}),
		),

	delete: oc
		.meta(
			openapi({
				method: "DELETE",
				path: "/sources/{sourceId}/media/{mediaId}",
				tags: ["Media"],
				summary: "メディア削除",
				description:
					"メディアソースから指定したメディアを削除します。関連する類似検索ベクトルも削除します。",
			}),
		)
		.input(mediaLocationSchema)
		.output(z.object({ success: z.boolean() })),

	copy: oc
		.meta(
			openapi({
				method: "POST",
				path: "/media/{mediaId}/copy",
				tags: ["Media"],
				summary: "メディアを別ソースへコピー",
				description: "指定したメディアを対象メディアソースへコピーします。",
			}),
		)
		.input(
			z.object({
				mediaId: z.uuid(),
				targetSourceId: z.uuid(),
			}),
		)
		.output(z.object({ success: z.boolean() })),

	move: oc
		.meta(
			openapi({
				method: "POST",
				path: "/media/{mediaId}/move",
				tags: ["Media"],
				summary: "メディアを別ソースへ移動",
				description: "指定したメディアを対象メディアソースへ移動します。",
			}),
		)
		.input(
			z.object({
				mediaId: z.uuid(),
				targetSourceId: z.uuid(),
			}),
		)
		.output(z.object({ success: z.boolean() })),

	reserveUploads: oc
		.meta(
			openapi({
				method: "POST",
				path: "/sources/{sourceId}/media/upload-reservations",
				tags: ["Media"],
				summary: "複数アップロードの取り込み対象を登録",
			}),
		)
		.input(
			z.object({
				sourceId: z.uuid(),
				filenames: z.array(z.string().min(1)).min(1),
			}),
		)
		.output(z.object({ jobId: z.uuid(), reservations: z.array(z.uuid()) })),
	upload: oc
		.errors({
			BATCH_CANCELLED: { status: 410, message: "Upload batch cancelled" },
		})
		.meta(
			openapi({
				method: "POST",
				path: "/sources/{sourceId}/media",
				tags: ["Media"],
				summary: "メディアアップロード",
				description:
					"画像または動画ファイルを指定したメディアソースへアップロードします。ファイル名、説明、取得元URL、上書き動作を指定できます。同名ファイルがあり上書き・連番保存のどちらも無効な場合は、アップロードをスキップしてsuccess=falseを返します。",
			}),
		)
		.input(
			z.object({
				sourceId: z.uuid(),
				file: z.file(),
				reservationId: z.uuid().optional(),
				filename: z.string().optional(),
				description: z.string().optional(),
				sourceUrl: z.string().optional(),
				overwrite: z.string().optional(),
				autoIncrement: z.string().optional(),
			}),
		)
		.output(uploadResponseSchema),

	findDuplicates: oc
		.meta(
			openapi({
				method: "POST",
				path: "/media/search/duplicates",
				tags: ["Media"],
				summary: "重複メディア検索",
				description:
					"任意のmediaSourceIdで対象ソースの画像を絞り込み、取得元URLの集合が完全一致するメディアを重複候補としてグループ化します。",
			}),
		)
		.input(findDuplicatesRequestSchema.optional())
		.output(findDuplicatesResponseSchema),

	bulkDelete: oc
		.meta(
			openapi({
				method: "POST",
				path: "/media/bulk-delete",
				tags: ["Media"],
				summary: "メディア一括削除",
				description:
					"指定したメディアソース内の複数メディアをまとめて削除します。",
			}),
		)
		.input(bulkDeleteMediaRequestSchema)
		.output(z.object({ success: z.boolean() })),

	bulkEdit: oc
		.meta(
			openapi({
				method: "PATCH",
				path: "/media/bulk-edit",
				tags: ["Media"],
				summary: "メディア一括編集",
				description: "指定した複数メディアに共通のメタデータ変更を適用します。",
			}),
		)
		.input(bulkEditMediaRequestSchema)
		.output(z.object({ success: z.boolean() })),

	bulkMove: oc
		.meta(
			openapi({
				method: "POST",
				path: "/media/bulk-move",
				tags: ["Media"],
				summary: "メディア一括移動",
				description:
					"同じメディアソース内の複数メディアを指定ディレクトリへ移動し、項目別の成功・失敗・未処理を返します。",
			}),
		)
		.input(bulkMoveMediaRequestSchema)
		.output(bulkMediaOperationResultSchema),

	updatePositiveTags: oc
		.meta(
			openapi({
				method: "PATCH",
				path: "/media/positive-tags",
				tags: ["Media"],
				summary: "メディアの正タグを更新",
			}),
		)
		.input(updatePositiveMediaTagsSchema)
		.output(z.object({ success: z.literal(true) })),

	bulkTag: oc
		.meta(
			openapi({
				method: "PATCH",
				path: "/media/tags",
				tags: ["Media"],
				summary: "メディアタグ一括変更",
				description: "複数メディアにタグを追加し、指定されたタグを削除します。",
			}),
		)
		.input(bulkTagMediaRequestSchema)
		.output(z.object({ success: z.boolean() })),

	bulkCopyToSource: oc
		.meta(
			openapi({
				method: "POST",
				path: "/media/bulk-copy-to-source",
				tags: ["Media"],
				summary: "メディア一括コピー",
				description:
					"指定した複数メディアを別のメディアソースへコピーし、項目別の成功・失敗・未処理を返します。成功済みの項目は再試行から除外してください。",
			}),
		)
		.input(bulkCopyToSourceMediaRequestSchema)
		.output(bulkMediaOperationResultSchema),

	bulkMoveToSource: oc
		.meta(
			openapi({
				method: "POST",
				path: "/media/bulk-move-to-source",
				tags: ["Media"],
				summary: "メディア一括ソース間移動",
				description:
					"指定した複数メディアを別のメディアソースへ移動し、項目別の成功・失敗・未処理を返します。",
			}),
		)
		.input(bulkMoveToSourceMediaRequestSchema)
		.output(bulkMediaOperationResultSchema),
};
