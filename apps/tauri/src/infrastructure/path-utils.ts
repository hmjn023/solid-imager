export function joinLocalPath(rootPath: string, relativePath: string) {
	if (/^(?:[A-Za-z]:[\\/]|\/)/.test(relativePath)) {
		return relativePath;
	}
	const separator = rootPath.includes("\\") ? "\\" : "/";
	const normalizedRoot = rootPath.replace(/[\\/]+$/, "");
	const normalizedRelative = relativePath.replace(/^[\\/]+/, "");
	return `${normalizedRoot}${separator}${normalizedRelative.replace(/[\\/]/g, separator)}`;
}

export function dirname(path: string) {
	const normalized = path.replace(/[\\/]+$/, "");
	const lastSeparator = Math.max(
		normalized.lastIndexOf("/"),
		normalized.lastIndexOf("\\"),
	);
	if (lastSeparator <= 0) {
		return normalized.includes("\\") ? "\\" : "/";
	}
	return normalized.slice(0, lastSeparator);
}

export function basename(path: string) {
	const segments = path.split(/[\\/]/);
	return segments[segments.length - 1] || path;
}

export function extname(path: string) {
	const name = basename(path);
	const lastDot = name.lastIndexOf(".");
	return lastDot >= 0 ? name.slice(lastDot) : "";
}

export function splitStemAndExt(fileName: string) {
	const extension = extname(fileName);
	if (!extension) {
		return { stem: fileName, extension: "" };
	}
	return {
		stem: fileName.slice(0, -extension.length),
		extension,
	};
}
