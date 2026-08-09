import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type {
	ManagerEntity,
	ManagerEntityType,
} from "../../hooks/use-manager-page";
import { MANAGER_CATEGORIES, type V2ManagerCategory } from "./types";

export function isCrudCategory(
	value: V2ManagerCategory,
): value is ManagerEntityType {
	return value === "projects" || value === "ips" || value === "characters";
}

export function isCharacter(item: ManagerEntity): item is Character {
	return "ips" in item;
}

export function isIp(item: ManagerEntity): item is Ip {
	return "source" in item;
}

export function categoryLabel(value: V2ManagerCategory): string {
	return (
		MANAGER_CATEGORIES.find((category) => category.value === value)?.label ??
		value
	);
}

export function singularLabel(value: ManagerEntityType): string {
	switch (value) {
		case "projects":
			return "Project";
		case "ips":
			return "IP";
		case "characters":
			return "Character";
		default:
			return "Item";
	}
}

export function formatDate(value: Date | string): string {
	return new Date(value).toLocaleDateString("ja-JP", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function formatBytes(bytes: number | null | undefined): string {
	if (bytes == null) return "—";
	if (bytes < 1024) return `${bytes} B`;
	return `${(bytes / 1024).toFixed(1)} KB`;
}
