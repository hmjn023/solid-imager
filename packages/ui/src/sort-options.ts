import type { MediaSort } from "@solid-imager/core/search";

export const SORT_OPTIONS = [
	"date",
	"modifiedAt",
	"indexedAt",
	"size",
	"resolution",
	"name",
	"rating",
	"viewCount",
] as const satisfies readonly MediaSort[];

export type SortOption = (typeof SORT_OPTIONS)[number];

export function getSortLabel(value: SortOption) {
	if (value === "date") {
		return "ファイル作成日時";
	}
	if (value === "modifiedAt") {
		return "更新日時";
	}
	if (value === "indexedAt") {
		return "登録日時";
	}
	if (value === "name") {
		return "名前";
	}
	if (value === "size") {
		return "ファイルサイズ";
	}
	if (value === "resolution") {
		return "解像度";
	}
	if (value === "rating") {
		return "評価";
	}
	return "閲覧数";
}
