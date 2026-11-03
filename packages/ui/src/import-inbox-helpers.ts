import type { DownloadItem } from "@solid-imager/core/media";
import type { SafeMediaSource } from "@solid-imager/core/sources";

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
