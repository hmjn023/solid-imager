import { t } from "@solid-imager/i18n";
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
		return t("sortOptions.fileCreationDate");
	}
	if (value === "modifiedAt") {
		return t("sortOptions.modifiedDate");
	}
	if (value === "indexedAt") {
		return t("sortOptions.registrationDate");
	}
	if (value === "name") {
		return t("labels.name");
	}
	if (value === "size") {
		return t("sortOptions.fileSize");
	}
	if (value === "resolution") {
		return t("collectionInspector.resolution");
	}
	if (value === "rating") {
		return t("sortOptions.rating");
	}
	return t("sortOptions.viewCount");
}
