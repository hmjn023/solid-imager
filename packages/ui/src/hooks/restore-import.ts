export type RestoreImportStrategy = "tar" | "ndjson" | "unsupported";

export function getRestoreImportStrategies(
	file: Pick<File, "name" | "type">,
	options?: {
		canImportNdjson?: boolean;
	},
): RestoreImportStrategy[] {
	const lowerName = file.name.toLowerCase();
	const isTarArchive =
		lowerName.endsWith(".tar") ||
		file.type === "application/x-tar" ||
		file.type === "application/tar";
	const isNdjsonFile =
		lowerName.endsWith(".ndjson") || file.type === "application/x-ndjson";
	if (isTarArchive) {
		return ["tar"];
	}
	if (isNdjsonFile) {
		return options?.canImportNdjson ? ["ndjson"] : ["unsupported"];
	}
	return ["unsupported"];
}
