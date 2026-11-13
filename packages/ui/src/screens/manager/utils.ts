import { getLocale, t } from "@solid-imager/i18n";
import type { Character } from "@solid-imager/core/characters";
import type { Ip } from "@solid-imager/core/ips";
import type {
	ManagerEntity,
	ManagerEntityType,
} from "../../hooks/use-manager-page";
import { MANAGER_CATEGORIES, type ManagerCategoryValue } from "./types";

export function isCrudCategory(
	value: ManagerCategoryValue,
): value is ManagerEntityType {
	return value === "projects" || value === "ips" || value === "characters";
}

export function isCharacter(item: ManagerEntity): item is Character {
	return "ips" in item;
}

export function isIp(item: ManagerEntity): item is Ip {
	return "source" in item;
}

export function categoryLabel(value: ManagerCategoryValue): string {
	return (
		MANAGER_CATEGORIES.find((category) => category.value === value)?.label ??
		value
	);
}

export function singularLabel(value: ManagerEntityType): string {
	switch (value) {
		case "projects":
			return t("labels.project");
		case "ips":
			return t("labels.ips");
		case "characters":
			return t("labels.character");
		default:
			return t("labels.item");
	}
}

export function formatDate(
	value: Date | string | null | undefined,
	options?: { includeTime?: boolean },
): string {
	if (value == null) {
		return "—";
	}
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "—";
	}
	return new Intl.DateTimeFormat(
		getLocale(),
		options?.includeTime
			? { dateStyle: "medium", timeStyle: "short" }
			: { year: "numeric", month: "short", day: "numeric" },
	).format(date);
}

export function formatBytes(bytes: number | null | undefined): string {
	if (bytes == null) return "—";
	if (bytes < 1024) return `${bytes} B`;
	return `${(bytes / 1024).toFixed(1)} KB`;
}
