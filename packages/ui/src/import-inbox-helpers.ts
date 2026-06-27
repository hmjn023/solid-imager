import type { DownloadItem } from "@solid-imager/core/domain/media/schemas";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";

export function getPreferredImportSourceId(sources: SafeMediaSource[]): string {
	return (
		sources.find((source) => source.name.toLowerCase() === "default")?.id ??
		sources[0]?.id ??
		""
	);
}

export function getPendingImportPrimaryAuthor(item: DownloadItem): string {
	return item.authors?.[0]?.name || "?";
}
