function readPublicOrigin(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const url = new URL(value);
	if (
		!["https:", "http:"].includes(url.protocol) ||
		url.username ||
		url.password ||
		url.pathname !== "/" ||
		url.search ||
		url.hash
	) {
		throw new Error(
			"API_PUBLIC_ORIGIN must be an HTTP(S) origin without credentials, path, query or fragment",
		);
	}
	return url.origin;
}

export const API_PUBLIC_ORIGIN = readPublicOrigin(
	process.env.API_PUBLIC_ORIGIN,
);

export function resolvePublicOrigin(request: Request): string {
	return API_PUBLIC_ORIGIN ?? new URL(request.url).origin;
}
