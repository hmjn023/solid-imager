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
	try {
		const parsed = new URL(url);
		const lastDot = parsed.pathname.lastIndexOf(".");
		if (lastDot === -1) return "";
		return parsed.pathname.slice(lastDot);
	} catch {
		return "";
	}
}
