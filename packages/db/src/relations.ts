import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
	mediaSources: {
		/** メディアソースに属するメディア */
		media: r.many.medias({
			from: r.mediaSources.id,
			to: r.medias.mediaSourceId,
		}),
	},
	medias: {
		/** メディアが属するメディアソース */
		source: r.one.mediaSources({
			from: r.medias.mediaSourceId,
			to: r.mediaSources.id,
			optional: false,
		}),
		/** メディアに付けられたタグ */
		tags: r.many.mediaTags({
			from: r.medias.id,
			to: r.mediaTags.mediaId,
		}),
		/** メディアの詳細情報 */
		details: r.one.mediaDetails({
			from: r.medias.id,
			to: r.mediaDetails.mediaId,
		}),
		/** メディアの生成情報 */
		generationInfo: r.one.mediaGenerationInfo({
			from: r.medias.id,
			to: r.mediaGenerationInfo.mediaId,
		}),
		/** メディアが属するカテゴリ */
		categories: r.many.mediaCategories({
			from: r.medias.id,
			to: r.mediaCategories.mediaId,
		}),
		/** メディアが属するプロジェクト */
		projects: r.many.mediaProjects({
			from: r.medias.id,
			to: r.mediaProjects.mediaId,
		}),
		/** メディアが属するIP */
		ips: r.many.mediaIps({
			from: r.medias.id,
			to: r.mediaIps.mediaId,
		}),
		/** メディアの技術情報 */
		technicalInfo: r.one.mediaTechnicalInfo({
			from: r.medias.id,
			to: r.mediaTechnicalInfo.mediaId,
		}),
		/** メディアの同期情報 */
		sync: r.one.mediaSync({
			from: r.medias.id,
			to: r.mediaSync.mediaId,
		}),
		/** メディアの閲覧履歴 */
		viewHistory: r.many.viewHistory({
			from: r.medias.id,
			to: r.viewHistory.mediaId,
		}),
		/** 類似メディア (media1) */
		similarMedia1: r.many.similarMedia({
			from: r.medias.id,
			to: r.similarMedia.media1Id,
			alias: "media1",
		}),
		/** 類似メディア (media2) */
		similarMedia2: r.many.similarMedia({
			from: r.medias.id,
			to: r.similarMedia.media2Id,
			alias: "media2",
		}),
		/** メディアが属するコレクション */
		collections: r.many.mediaCollections({
			from: r.medias.id,
			to: r.mediaCollections.mediaId,
		}),
		/** メディアに含まれるキャラクター */
		characters: r.many.mediaCharacters({
			from: r.medias.id,
			to: r.mediaCharacters.mediaId,
		}),
		/** このメディアを親とする関連メディア */
		childRelations: r.many.mediaRelationsTable({
			from: r.medias.id,
			to: r.mediaRelationsTable.parentMediaId,
			alias: "parent",
		}),
		/** このメディアを子とする関連メディア */
		parentRelations: r.many.mediaRelationsTable({
			from: r.medias.id,
			to: r.mediaRelationsTable.childMediaId,
			alias: "child",
		}),
		/** メディアのSource URLリスト */
		urls: r.many.mediaUrls({
			from: r.medias.id,
			to: r.mediaUrls.mediaId,
		}),
		/** メディアのAuthorリスト */
		authors: r.many.authors({
			from: r.medias.id.through(r.mediaAuthors.mediaId),
			to: r.authors.id.through(r.mediaAuthors.authorId),
		}),
	},
	tags: {
		/** タグが付与されたメディア */
		media: r.many.mediaTags({
			from: r.tags.id,
			to: r.mediaTags.tagId,
		}),
		/** タグに関連するAuthor */
		author: r.one.authors({
			from: r.tags.authorId,
			to: r.authors.id,
		}),
	},
	mediaTags: {
		/** 中間テーブルが参照するメディア */
		media: r.one.medias({
			from: r.mediaTags.mediaId,
			to: r.medias.id,
			optional: false,
		}),
		/** 中間テーブルが参照するタグ */
		tag: r.one.tags({
			from: r.mediaTags.tagId,
			to: r.tags.id,
			optional: false,
		}),
	},
	categories: {
		/** 親カテゴリ */
		parent: r.one.categories({
			from: r.categories.parentId,
			to: r.categories.id,
			alias: "parent_category",
		}),
		/** 子カテゴリ */
		children: r.many.categories({
			from: r.categories.id,
			to: r.categories.parentId,
			alias: "parent_category",
		}),
		/** カテゴリに属するメディア */
		media: r.many.mediaCategories({
			from: r.categories.id,
			to: r.mediaCategories.categoryId,
		}),
	},
	projects: {
		/** プロジェクトに属するメディア */
		media: r.many.mediaProjects({
			from: r.projects.id,
			to: r.mediaProjects.projectId,
		}),
	},
	ips: {
		/** IPに属するメディア */
		media: r.many.mediaIps({
			from: r.ips.id,
			to: r.mediaIps.ipId,
		}),
		/** IPに属するキャラクター (中間テーブル経由) */
		characters: r.many.characterIps({
			from: r.ips.id,
			to: r.characterIps.ipId,
		}),
	},
	characters: {
		/** キャラクターが属するIP (中間テーブル経由) */
		ips: r.many.ips({
			from: r.characters.id.through(r.characterIps.characterId),
			to: r.ips.id.through(r.characterIps.ipId),
		}),
		/** キャラクターが含まれるメディア */
		media: r.many.mediaCharacters({
			from: r.characters.id,
			to: r.mediaCharacters.characterId,
		}),
	},
	characterIps: {
		/** 中間テーブルが参照するキャラクター */
		character: r.one.characters({
			from: r.characterIps.characterId,
			to: r.characters.id,
			optional: false,
		}),
		/** 中間テーブルが参照するIP */
		ip: r.one.ips({
			from: r.characterIps.ipId,
			to: r.ips.id,
			optional: false,
		}),
	},
	mediaCharacters: {
		/** 中間テーブルが参照するメディア */
		media: r.one.medias({
			from: r.mediaCharacters.mediaId,
			to: r.medias.id,
			optional: false,
		}),
		/** 中間テーブルが参照するキャラクター */
		character: r.one.characters({
			from: r.mediaCharacters.characterId,
			to: r.characters.id,
			optional: false,
		}),
	},
	mediaCategories: {
		/** 中間テーブルが参照するメディア */
		media: r.one.medias({
			from: r.mediaCategories.mediaId,
			to: r.medias.id,
			optional: false,
		}),
		/** 中間テーブルが参照するカテゴリ */
		category: r.one.categories({
			from: r.mediaCategories.categoryId,
			to: r.categories.id,
			optional: false,
		}),
	},
	mediaProjects: {
		/** 中間テーブルが参照するメディア */
		media: r.one.medias({
			from: r.mediaProjects.mediaId,
			to: r.medias.id,
			optional: false,
		}),
		/** 中間テーブルが参照するプロジェクト */
		project: r.one.projects({
			from: r.mediaProjects.projectId,
			to: r.projects.id,
			optional: false,
		}),
	},
	mediaIps: {
		/** 中間テーブルが参照するメディア */
		media: r.one.medias({
			from: r.mediaIps.mediaId,
			to: r.medias.id,
			optional: false,
		}),
		/** 中間テーブルが参照するIP */
		ip: r.one.ips({
			from: r.mediaIps.ipId,
			to: r.ips.id,
			optional: false,
		}),
	},
	viewHistory: {
		/** 閲覧履歴が参照するメディア */
		media: r.one.medias({
			from: r.viewHistory.mediaId,
			to: r.medias.id,
			optional: false,
		}),
	},
	similarMedia: {
		/** 類似メディア1 */
		media1: r.one.medias({
			from: r.similarMedia.media1Id,
			to: r.medias.id,
			optional: false,
			alias: "media1",
		}),
		/** 類似メディア2 */
		media2: r.one.medias({
			from: r.similarMedia.media2Id,
			to: r.medias.id,
			optional: false,
			alias: "media2",
		}),
	},
	mediaRelationsTable: {
		/** 親メディア */
		parentMedia: r.one.medias({
			from: r.mediaRelationsTable.parentMediaId,
			to: r.medias.id,
			optional: false,
			alias: "parent",
		}),
		/** 子メディア */
		childMedia: r.one.medias({
			from: r.mediaRelationsTable.childMediaId,
			to: r.medias.id,
			optional: false,
			alias: "child",
		}),
	},
	collections: {
		media: r.many.mediaCollections({
			from: r.collections.id,
			to: r.mediaCollections.collectionId,
		}),
		/** どのユーザーのコレクションか */
		user: r.one.users({
			from: r.collections.userId,
			to: r.users.id,
			optional: false,
		}),
	},
	mediaCollections: {
		/** 中間テーブルが参照するコレクション */
		collection: r.one.collections({
			from: r.mediaCollections.collectionId,
			to: r.collections.id,
			optional: false,
		}),
		/** 中間テーブルが参照するメディア */
		media: r.one.medias({
			from: r.mediaCollections.mediaId,
			to: r.medias.id,
			optional: false,
		}),
	},
	authors: {
		/** Authorに関連するメディア */
		media: r.many.mediaAuthors({
			from: r.authors.id,
			to: r.mediaAuthors.authorId,
		}),
		/** Authorの外部サービス上のアカウント */
		accounts: r.many.authorAccounts({
			from: r.authors.id,
			to: r.authorAccounts.authorId,
		}),
		/** Authorに関連するタグ */
		tags: r.many.tags({
			from: r.authors.id,
			to: r.tags.authorId,
		}),
	},
	authorAccounts: {
		author: r.one.authors({
			from: r.authorAccounts.authorId,
			to: r.authors.id,
			optional: false,
		}),
	},
	mediaAuthors: {
		/** 中間テーブルが参照するメディア */
		media: r.one.medias({
			from: r.mediaAuthors.mediaId,
			to: r.medias.id,
			optional: false,
		}),
		/** 中間テーブルが参照するAuthor */
		author: r.one.authors({
			from: r.mediaAuthors.authorId,
			to: r.authors.id,
			optional: false,
		}),
	},
	mediaUrls: {
		/** URLが属するメディア */
		media: r.one.medias({
			from: r.mediaUrls.mediaId,
			to: r.medias.id,
			optional: false,
		}),
	},
	users: {
		/** ユーザーが持つコレクション */
		collections: r.many.collections({
			from: r.users.id,
			to: r.collections.userId,
		}),
	},
}));
