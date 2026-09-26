import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	aiHealthResponseSchema,
	batchCcipExtractionRequestSchema,
	batchTaggingRequestSchema,
	batchTargetCountResponseSchema,
	ccipDifferenceRequestSchema,
	ccipDistancesRequestSchema,
	ccipDistancesResponseSchema,
	ccipExtractionRequestSchema,
	ccipFeatureRequestSchema,
	ccipVectorStatusSchema,
	detectAndCropResponseSchema,
	oppaiOracleResponseSchema,
	startBatchTaggingResponseSchema,
	startCcipExtractionResponseSchema,
	taggingResponseSchema,
	tagImageRequestSchema,
} from "../tagging/schemas";

export const aiContract = {
	health: oc
		.route({
			tags: ["AI"],
			summary: "AIサービス状態確認",
			description:
				"画像解析やタグ付けに使うAIサービスが稼働しているか確認します。各AI機能の利用前に接続状態を確認できます。",
		})
		.output(aiHealthResponseSchema),
	tag: oc
		.route({
			tags: ["AI"],
			summary: "画像の自動タグ付け",
			description:
				"画像ファイルまたはメディアIDを受け取り、利用可能なタグ付けモデルで内容を解析してタグ候補を返します。",
		})

		.input(
			z.union([z.object({ file: z.instanceof(File) }), tagImageRequestSchema]),
		)
		.output(taggingResponseSchema),

	tagOppaiOracle: oc
		.route({
			tags: ["AI"],
			summary: "OppaiOracleで画像をタグ付け",
			description:
				"画像ファイルまたはメディアIDをOppaiOracleで解析し、検出結果とタグ候補を返します。",
		})

		.input(
			z.union([z.object({ file: z.instanceof(File) }), tagImageRequestSchema]),
		)
		.output(oppaiOracleResponseSchema),

	ccipFeature: oc
		.route({
			tags: ["AI"],
			summary: "CCIP特徴量の抽出",
			description:
				"画像ファイルまたはメディアIDからCCIP特徴量を計算して返します。類似画像検索や画像間比較に利用できます。",
		})
		.input(
			z.union([
				z.object({ file: z.instanceof(File) }),
				ccipFeatureRequestSchema,
			]),
		),

	ccipDifference: oc
		.route({
			tags: ["AI"],
			summary: "画像のCCIP差分計算",
			description:
				"2枚の画像を指定してCCIP特徴量の差分を計算し、画像間の違いを返します。",
		})
		.input(ccipDifferenceRequestSchema),

	ccipDistances: oc
		.route({
			tags: ["AI"],
			summary: "CCIP距離の計算",
			description:
				"基準画像と比較対象の画像群を受け取り、CCIP特徴量に基づく距離を返します。",
		})

		.input(ccipDistancesRequestSchema)
		.output(ccipDistancesResponseSchema),

	ccipVectorStatus: oc
		.route({
			tags: ["AI"],
			summary: "メディアのCCIP登録状態取得",
			description:
				"指定したメディアに対するCCIP特徴量の抽出・ベクトル登録状態を取得します。",
		})

		.input(
			ccipExtractionRequestSchema.pick({ mediaSourceId: true, mediaId: true }),
		)
		.output(ccipVectorStatusSchema),

	startCcipExtraction: oc
		.route({
			tags: ["AI"],
			summary: "CCIP特徴量抽出の開始",
			description:
				"指定したメディアのCCIP特徴量を抽出してベクトルストアへ登録するジョブを開始します。",
		})

		.input(ccipExtractionRequestSchema)
		.output(startCcipExtractionResponseSchema),

	scanBatchCcipTargets: oc
		.route({
			tags: ["AI"],
			summary: "CCIP一括処理対象の確認",
			description:
				"指定条件に一致し、CCIP特徴量抽出の対象となるメディア数を確認します。",
		})

		.input(batchCcipExtractionRequestSchema)
		.output(batchTargetCountResponseSchema),

	startBatchCcipExtraction: oc
		.route({
			tags: ["AI"],
			summary: "CCIP一括抽出の開始",
			description:
				"指定条件に一致するメディアを対象に、CCIP特徴量を一括抽出するジョブを開始します。",
		})

		.input(batchCcipExtractionRequestSchema)
		.output(startCcipExtractionResponseSchema),

	scanBatchTaggingTargets: oc
		.route({
			tags: ["AI"],
			summary: "一括タグ付け対象の確認",
			description:
				"指定条件に一致し、自動タグ付けの対象となるメディア数を確認します。",
		})

		.input(batchTaggingRequestSchema)
		.output(batchTargetCountResponseSchema),

	startBatchTagging: oc
		.route({
			tags: ["AI"],
			summary: "一括タグ付けの開始",
			description:
				"指定条件に一致するメディアを対象に、自動タグ付けジョブを開始します。",
		})

		.input(batchTaggingRequestSchema)
		.output(startBatchTaggingResponseSchema),

	detectAndCropCharacters: oc
		.route({
			tags: ["AI"],
			summary: "キャラクター領域の検出と切り抜き",
			description:
				"画像ファイルまたはメディアIDからキャラクター領域を検出して切り抜きます。必要に応じて背景を透過できます。",
		})

		.input(
			z.union([
				z.object({
					mediaId: z.string().uuid(),
					transparent: z.boolean().optional().default(false),
				}),
				z.object({
					file: z.instanceof(File),
					transparent: z.boolean().optional().default(false),
				}),
			]),
		)
		.output(detectAndCropResponseSchema),
};
