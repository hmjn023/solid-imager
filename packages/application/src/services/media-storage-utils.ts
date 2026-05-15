import type {
	MediaMetadata,
	MediaStorageResult,
} from "@solid-imager/core/interfaces/media-storage";

/**
 * Resolves a path safely, ensuring it remains within the base path.
 * Prevents path traversal attacks. Works cross-platform (Unix/Windows).
 *
 * @param separator - Optional path separator. If not provided, it is inferred from the base path.
 */
export function resolveSafePath(
	basePath: string,
	targetPath: string,
	separator?: string,
): string {
	const pathSeparator =
		(separator ?? (basePath.includes("\\") && !basePath.includes("/")))
			? "\\"
			: "/";
	const normalizedBase = basePath
		.replace(/[\\/]+$/, "")
		.replace(/[\\/]/g, pathSeparator);
	const normalizedTarget = targetPath
		.replace(/[\\/]+$/, "")
		.replace(/[\\/]/g, pathSeparator);

	// If target is absolute, it must be within base
	const isAbsolute = /^(?:[A-Za-z]:)?[\\/]/.test(normalizedTarget);
	if (isAbsolute) {
		const lowerBase = normalizedBase.toLowerCase();
		const lowerTarget = normalizedTarget.toLowerCase();
		if (lowerTarget === lowerBase) {
			return normalizedTarget;
		}
		const baseWithSep = lowerBase + pathSeparator;
		if (lowerTarget.startsWith(baseWithSep)) {
			return normalizedTarget;
		}
		throw new Error(`Invalid path: ${targetPath}`);
	}

	// Resolve relative path manually
	const baseParts = normalizedBase.split(pathSeparator);
	const targetParts = normalizedTarget
		.split(pathSeparator)
		.filter((s) => s.length > 0);

	const resolvedParts = [...baseParts];
	for (const part of targetParts) {
		if (part === "..") {
			if (resolvedParts.length === 0) {
				throw new Error(`Invalid path: ${targetPath}`);
			}
			const last = resolvedParts[resolvedParts.length - 1];
			// Don't pop root or drive letter
			if (last === "") {
				throw new Error(`Invalid path: ${targetPath}`);
			}
			if (/^[A-Za-z]:$/.test(last) && resolvedParts.length === 1) {
				throw new Error(`Invalid path: ${targetPath}`);
			}
			resolvedParts.pop();
		} else if (part !== "." && part !== "") {
			resolvedParts.push(part);
		}
	}

	const resolvedPath = resolvedParts.join(pathSeparator);

	const lowerResolved = resolvedPath.toLowerCase();
	const lowerBase = normalizedBase.toLowerCase();

	if (
		lowerResolved !== lowerBase &&
		!lowerResolved.startsWith(lowerBase + pathSeparator.toLowerCase())
	) {
		throw new Error(`Invalid path: ${targetPath}`);
	}

	return resolvedPath;
}

/**
 * Builds a MediaStorageResult from extracted metadata and path information.
 * Pure logic shared between platform adapters.
 */
export function buildMediaStorageResult(
	metadata: MediaMetadata,
	relativePath: string,
	fileName: string,
	conflict?: MediaStorageResult["conflict"],
): MediaStorageResult {
	return {
		filePath: relativePath,
		fileName,
		width: metadata.width,
		height: metadata.height,
		size: metadata.size,
		createdAt: metadata.createdAt,
		modifiedAt: metadata.modifiedAt,
		conflict,
	};
}

/**
 * Executes an operation and runs cleanup if it throws.
 * Used for the "save/copy file → extract metadata → return result" pattern
 * where the file must be removed if metadata extraction fails.
 */
export async function withCleanup<T>(
	operation: () => Promise<T>,
	cleanup: () => Promise<void> | void,
): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		try {
			await cleanup();
		} catch (_) {
			// Ignore cleanup errors; preserve original error
		}
		throw error;
	}
}
