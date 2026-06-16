export type RestoreImportStrategy =
	| "lancedb"
	| "tar"
	| "ndjson"
	| "json"
	| "unsupported";

export function getRestoreImportStrategies(
	file: Pick<File, "name" | "type">,
	options?: {
		canImportNdjson?: boolean;
		canImportLanceDb?: boolean;
	},
): RestoreImportStrategy[] {
	const lowerName = file.name.toLowerCase();
	const isTarArchive =
		lowerName.endsWith(".tar") ||
		file.type === "application/x-tar" ||
		file.type === "application/tar";
	const isNdjsonFile =
		lowerName.endsWith(".ndjson") || file.type === "application/x-ndjson";
	const isLegacyJsonFile =
		lowerName.endsWith(".json") || file.type === "application/json";

	if (isTarArchive) {
		return options?.canImportLanceDb ? ["lancedb", "tar"] : ["tar"];
	}
	if (isNdjsonFile) {
		return options?.canImportNdjson ? ["ndjson"] : ["unsupported"];
	}
	if (isLegacyJsonFile) {
		return ["json"];
	}
	return ["unsupported"];
}
