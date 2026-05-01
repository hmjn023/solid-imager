export function basenameFromUrl(url: string): string | undefined {
	try {
		const parsed = new URL(url);
		const fileName = parsed.pathname.split("/").pop();
		return fileName || undefined;
	} catch {
		return undefined;
	}
}

export function guessExtensionFromUrl(url: string): string {
	const fileName = basenameFromUrl(url);
	if (!fileName) return "";
	const lastDot = fileName.lastIndexOf(".");
	if (lastDot === -1 || lastDot === 0) return "";
	return fileName.slice(lastDot);
}
