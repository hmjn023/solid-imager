import { openapi } from "@orpc/openapi";
import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	characterSchema,
	startCharacterClusteringSchema,
	newCharacterSchema,
	updateCharacterSchema,
	clusteringRunSummarySchema,
	clusteringGroupsRequestSchema,
	clusteringGroupsResponseSchema,
	clusteringMediaRequestSchema,
	clusteringMediaResponseSchema,
} from "../characters/schemas";

export const charactersContract = {
	startClustering: oc
		.meta(
			openapi({
				method: "POST",
				tags: ["Characters"],
				summary: "キャラクタークラスタリングを開始",
				description:
					"保存済みCCIPのsolo画像から近傍を抽出し、HDBSCANの結果を新規保存するジョブを投入します。",
			}),
		)
		.input(startCharacterClusteringSchema)
		.output(z.object({ jobId: z.uuid() })),
	clusteringRuns: oc
		.meta(
			openapi({
				tags: ["Characters"],
				summary: "保存済みクラスタリング結果一覧",
				description: "保存済み解析結果の条件と件数を取得します。",
			}),
		)
		.output(z.array(clusteringRunSummarySchema)),
	clusteringGroups: oc
		.meta(
			openapi({
				tags: ["Characters"],
				summary: "クラスタリングのグループ一覧",
				description:
					"既存ラベル・ファイル名で絞り込み、代表例と境界例をページ取得します。",
			}),
		)
		.input(clusteringGroupsRequestSchema)
		.output(clusteringGroupsResponseSchema),
	clusteringMedia: oc
		.meta(
			openapi({
				tags: ["Characters"],
				summary: "クラスタ・ノイズの画像一覧",
				description:
					"指定グループまたはノイズの全画像をページ取得し、別設定での所属先も確認します。",
			}),
		)
		.input(clusteringMediaRequestSchema)
		.output(clusteringMediaResponseSchema),
	list: oc
		.meta(
			openapi({
				tags: ["Characters"],
				summary: "キャラクター一覧取得",
				description: "登録済みのキャラクターを一覧で取得します。",
			}),
		)
		.output(z.array(characterSchema)),

	get: oc
		.meta(
			openapi({
				tags: ["Characters"],
				summary: "キャラクター取得",
				description: "UUIDで指定したキャラクターの情報を取得します。",
			}),
		)
		.input(z.object({ id: z.uuid() }))
		.output(characterSchema),

	create: oc
		.meta(
			openapi({
				tags: ["Characters"],
				summary: "キャラクター作成",
				description: "新しいキャラクターを登録します。",
			}),
		)
		.input(newCharacterSchema)
		.output(characterSchema),

	update: oc
		.meta(
			openapi({
				tags: ["Characters"],
				summary: "キャラクター更新",
				description: "UUIDで指定したキャラクターの情報を更新します。",
			}),
		)
		.input(
			z.object({
				id: z.uuid(),
				data: updateCharacterSchema,
			}),
		)
		.output(characterSchema),

	delete: oc
		.meta(
			openapi({
				tags: ["Characters"],
				summary: "キャラクター削除",
				description: "UUIDで指定したキャラクターを削除します。",
			}),
		)
		.input(z.object({ id: z.uuid() })),

	listForMedia: oc
		.meta(
			openapi({
				tags: ["Characters"],
				summary: "メディアのキャラクター一覧取得",
				description:
					"指定したメディアに関連付けられているキャラクターを一覧で取得します。",
			}),
		)
		.input(z.object({ mediaId: z.uuid() }))
		.output(z.array(characterSchema)),

	addToMedia: oc
		.meta(
			openapi({
				tags: ["Characters"],
				summary: "メディアにキャラクターを追加",
				description: "指定したキャラクターをメディアに関連付けます。",
			}),
		)
		.input(
			z.object({
				mediaId: z.uuid(),
				characterId: z.uuid(),
			}),
		)
		.output(z.object({ success: z.boolean() })),

	removeFromMedia: oc
		.meta(
			openapi({
				tags: ["Characters"],
				summary: "メディアからキャラクターを削除",
				description: "指定したキャラクターとメディアの関連付けを解除します。",
			}),
		)
		.input(
			z.object({
				mediaId: z.uuid(),
				characterId: z.uuid(),
			}),
		)
		.output(z.object({ success: z.boolean() })),
};
