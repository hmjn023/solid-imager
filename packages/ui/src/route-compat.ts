const ROUTER_ORIGIN = "http://solid-imager.invalid";

/**
 * Maps the retired, versioned UI paths to their canonical routes.
 *
 * This helper intentionally recognizes only the routes that existed in the
 * retired UI. Unknown paths return null so the caller can render its normal
 * not-found surface. Query strings and hashes are kept intact for redirects.
 */
export function toCanonicalLegacyHref(href: string): string | null {
	const url = new URL(href, ROUTER_ORIGIN);
	const path = url.pathname.replace(/\/+$/, "") || "/";
	if (path === "/v2") {
		return `/search${url.search}${url.hash}`;
	}
	if (!path.startsWith("/v2/")) {
		return null;
	}

	const segments = path.slice("/v2/".length).split("/").filter(Boolean);
	const first = segments[0];
	const knownSingleSegmentRoutes = new Set([
		"about",
		"config",
		"jobs",
		"manager",
		"search",
		"sources",
	]);
	let canonicalPath: string | null = null;
	if (segments.length === 1 && first && knownSingleSegmentRoutes.has(first)) {
		canonicalPath = `/${first}`;
	} else if (
		first === "sources" &&
		(segments.length === 2 || segments.length === 3) &&
		segments.slice(1).every((segment) => segment.length > 0)
	) {
		canonicalPath = `/${segments.join("/")}`;
	}

	return canonicalPath ? `${canonicalPath}${url.search}${url.hash}` : null;
}
