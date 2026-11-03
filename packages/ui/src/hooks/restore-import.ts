export type RestoreImportStrategy = "tar" | "ndjson" | "unsupported";

/**
 * Selects an import strategy from the filename or MIME type. TAR takes precedence
 * when both match; NDJSON requires explicit capability opt-in.
 *
 * @param file - Filename and MIME type reported by the file picker.
 * @param options - Set canImportNdjson when the caller supports NDJSON imports.
 * @returns A single-element strategy list, including unsupported for unrecognized files.
 */
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
