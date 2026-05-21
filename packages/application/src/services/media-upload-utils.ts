import type { MediaPathAdapter } from "./media-service";

export type ResolvedUploadTarget = {
	relativePath: string;
	fullPath: string;
	conflict?: {
		existingFile: string;
		suggestedName: string;
	};
};

export function normalizeRelativePath(path: string) {
	return path
		.split(/[\\/]+/)
		.filter((segment) => segment.length > 0 && segment !== ".")
		.join("/");
}

export function isSafeRelativeUploadPath(path: string) {
	if (/^(?:[A-Za-z]:[\\/]|\/)/.test(path)) {
		return false;
	}
	return path
		.split(/[\\/]+/)
		.every(
			(segment) => segment.length === 0 || segment === "." || segment !== "..",
		);
}

export async function resolveUploadTargetPath(
	rootPath: string,
	requestedPath: string,
	overwrite: boolean,
	autoIncrement: boolean,
	deps: {
		pathAdapter: MediaPathAdapter;
		exists: (path: string) => Promise<boolean>;
		maxAttempts?: number;
		skipIfEquals?: string;
	},
): Promise<ResolvedUploadTarget> {
	if (!isSafeRelativeUploadPath(requestedPath)) {
		throw new Error(`Invalid upload path: ${requestedPath}`);
	}

	const normalizedRequested = normalizeRelativePath(requestedPath);
	const requestedFullPath = deps.pathAdapter.join(
		rootPath,
		normalizedRequested,
	);
	if (overwrite || !(await deps.exists(requestedFullPath))) {
		if (!deps.skipIfEquals || requestedFullPath !== deps.skipIfEquals) {
			return {
				relativePath: normalizedRequested,
				fullPath: requestedFullPath,
			};
		}
	}

	if (!autoIncrement) {
		throw new Error(`File already exists: ${normalizedRequested}`);
	}

	const lastSlash = normalizedRequested.lastIndexOf("/");
	const parentDir =
		lastSlash === -1 ? "" : normalizedRequested.substring(0, lastSlash);
	const extension = deps.pathAdapter.extname(normalizedRequested);
	const stem = deps.pathAdapter
		.basename(normalizedRequested)
		.slice(
			0,
			Math.max(
				0,
				deps.pathAdapter.basename(normalizedRequested).length -
					extension.length,
			),
		);

	let index = 1;
	const maxAttempts = deps.maxAttempts ?? 1000;
	while (index <= maxAttempts) {
		const candidateName = `${stem}_${index}${extension}`;
		const candidateRelative =
			parentDir === "" || parentDir === "/"
				? candidateName
				: normalizeRelativePath(`${parentDir}/${candidateName}`);
		const candidateFullPath = deps.pathAdapter.join(
			rootPath,
			candidateRelative,
		);
		if (
			!(await deps.exists(candidateFullPath)) ||
			(deps.skipIfEquals && candidateFullPath === deps.skipIfEquals)
		) {
			return {
				relativePath: candidateRelative,
				fullPath: candidateFullPath,
				conflict: {
					existingFile: normalizedRequested,
					suggestedName: candidateRelative,
				},
			};
		}
		index += 1;
	}

	throw new Error(
		`Could not resolve a non-conflicting filename after ${maxAttempts} attempts`,
	);
}
