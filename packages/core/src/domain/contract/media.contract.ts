import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	bulkCopyToSourceMediaRequestSchema,
	bulkDeleteMediaRequestSchema,
	bulkEditMediaRequestSchema,
	bulkMoveMediaRequestSchema,
	bulkMoveToSourceMediaRequestSchema,
	bulkTagMediaRequestSchema,
	findDuplicatesRequestSchema,
	findDuplicatesResponseSchema,
	mediaDetailsSchema,
	mediaSchema,
	mediaSearchRequestSchema,
	mediaSearchResponseSchema,
	similarMediaSearchResponseSchema,
	tagSchema,
	updateMediaRequestSchema,
} from "../media/schemas";
import { uploadResponseSchema } from "../media/upload-schemas";
import { similarMediaRequestSchema } from "../tagging/schemas";

export const mediaContract = {
	search: oc
		.route({
			tags: ["Media"],
			summary: "メディア検索",
			description:
				"メディアソースと検索条件を指定してメディアを検索します。タグ、カテゴリ、作品、キャラクターなどの条件や並び順を利用できます。",
		})
		.input(
			z.object({
				sourceId: z.string().uuid().nullish(),
				params: mediaSearchRequestSchema,
			}),
		)
		.output(mediaSearchResponseSchema),

	searchSimilar: oc
		.route({
			tags: ["Media"],
			summary: "類似メディア検索",
			description:
				"指定した基準メディアに視覚的特徴が近いメディアを検索し、類似度順の結果を返します。",
		})
		.input(similarMediaRequestSchema)
		.output(similarMediaSearchResponseSchema),

	get: oc
		.route({
			tags: ["Media"],
			summary: "メディア取得",
			description:
				"メディアソースIDとメディアIDで指定したメディアの基本情報を取得します。",
		})
		.input(
			z.object({
				sourceId: z.string().uuid(),
				mediaId: z.string().uuid(),
			}),
		)
		.output(mediaSchema),

	getDetails: oc
		.route({
			tags: ["Media"],
			summary: "メディア詳細取得",
			description:
				"指定したメディアの基本情報に加え、タグやカテゴリ、作品、キャラクターなどの関連情報を取得します。",
		})
		.input(
			z.object({
				sourceId: z.string().uuid(),
				mediaId: z.string().uuid(),
			}),
		)
		.output(mediaDetailsSchema),

	getContent: oc
		.route({
			tags: ["Media"],
			summary: "メディア本体取得（非対応）",
			description:
				"このoRPC操作はバイナリ本体を返せないため、呼び出すとBAD_REQUESTになります。画像や動画本体の取得には専用RESTルートを使用してください。",
		})
		.input(
			z.object({
				sourceId: z.string().uuid(),
				mediaId: z.string().uuid(),
			}),
		)
		.output(z.never()),

	getTags: oc
		.route({
			tags: ["Media"],
			summary: "メディアタグ一覧取得",
			description:
				"指定したメディアに関連付けられているタグを一覧で取得します。",
		})
		.input(
			z.object({
				sourceId: z.string().uuid(),
				mediaId: z.string().uuid(),
			}),
		)
		.output(z.array(tagSchema)),

	update: oc
		.route({
			tags: ["Media"],
			summary: "メディア情報更新",
			description:
				"指定したメディアの説明、カテゴリ、撮影・生成情報などの編集可能なメタデータを更新します。",
		})
		.input(
			z.object({
				sourceId: z.string().uuid(),
				mediaId: z.string().uuid(),
				data: updateMediaRequestSchema,
			}),
		)
		.output(mediaSchema),

	sync: oc
		.route({
			tags: ["Media"],
			summary: "メディア情報の再解析",
			description:
				"指定したメディアのメタデータとタグを再抽出します。複数件は同時実行数を制限して処理し、各メディアの成功・失敗結果を返します。",
		})
		.input(
			z.object({
				sourceId: z.string().uuid(),
				mediaIds: z.array(z.string().uuid()),
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
		.route({
			tags: ["Media"],
			summary: "メディア削除",
			description:
				"メディアソースから指定したメディアを削除します。関連する類似検索ベクトルも削除します。",
		})
		.input(
			z.object({
				sourceId: z.string().uuid(),
				mediaId: z.string().uuid(),
			}),
		)
		.output(z.object({ success: z.boolean() })),

	copy: oc
		.route({
			tags: ["Media"],
			summary: "メディアを別ソースへコピー",
			description: "指定したメディアを対象メディアソースへコピーします。",
		})
		.input(
			z.object({
				mediaId: z.string().uuid(),
				targetSourceId: z.string().uuid(),
			}),
		)
		.output(z.object({ success: z.boolean() })),

	move: oc
		.route({
			tags: ["Media"],
			summary: "メディアを別ソースへ移動",
			description: "指定したメディアを対象メディアソースへ移動します。",
		})
		.input(
			z.object({
				mediaId: z.string().uuid(),
				targetSourceId: z.string().uuid(),
			}),
		)
		.output(z.object({ success: z.boolean() })),

	upload: oc
		.route({
			tags: ["Media"],
			summary: "メディアアップロード",
			description:
				"画像または動画ファイルを指定したメディアソースへアップロードします。ファイル名、説明、取得元URL、上書き動作を指定できます。",
		})
		.input(
			z.object({
				sourceId: z.string().uuid(),
				file: z.instanceof(File),
				filename: z.string().optional(),
				description: z.string().optional(),
				sourceUrl: z.string().optional(),
				overwrite: z.string().optional(),
				autoIncrement: z.string().optional(),
			}),
		)
		.output(uploadResponseSchema),

	findDuplicates: oc
		.route({
			tags: ["Media"],
			summary: "重複メディア検索",
			description:
				"任意のmediaSourceIdで対象ソースの画像を絞り込み、取得元URLの集合が完全一致するメディアを重複候補としてグループ化します。",
		})
		.input(findDuplicatesRequestSchema.optional())
		.output(findDuplicatesResponseSchema),

	bulkDelete: oc
		.route({
			tags: ["Media"],
			summary: "メディア一括削除",
			description:
				"指定したメディアソース内の複数メディアをまとめて削除します。",
		})
		.input(bulkDeleteMediaRequestSchema)
		.output(z.object({ success: z.boolean() })),

	bulkEdit: oc
		.route({
			tags: ["Media"],
			summary: "メディア一括編集",
			description: "指定した複数メディアに共通のメタデータ変更を適用します。",
		})
		.input(bulkEditMediaRequestSchema)
		.output(z.object({ success: z.boolean() })),

	bulkMove: oc
		.route({
			tags: ["Media"],
			summary: "メディア一括移動",
			description:
				"同じメディアソース内の複数メディアを指定ディレクトリへ移動します。",
		})
		.input(bulkMoveMediaRequestSchema)
		.output(z.object({ success: z.boolean() })),

	bulkTag: oc
		.route({
			tags: ["Media"],
			summary: "メディアタグ一括変更",
			description: "複数メディアにタグを追加し、指定されたタグを削除します。",
		})
		.input(bulkTagMediaRequestSchema)
		.output(z.object({ success: z.boolean() })),

	bulkCopyToSource: oc
		.route({
			tags: ["Media"],
			summary: "メディア一括コピー",
			description: "指定した複数メディアを別のメディアソースへコピーします。",
		})
		.input(bulkCopyToSourceMediaRequestSchema)
		.output(z.object({ success: z.boolean() })),

	bulkMoveToSource: oc
		.route({
			tags: ["Media"],
			summary: "メディア一括ソース間移動",
			description: "指定した複数メディアを別のメディアソースへ移動します。",
		})
		.input(bulkMoveToSourceMediaRequestSchema)
		.output(z.object({ success: z.boolean() })),
};
