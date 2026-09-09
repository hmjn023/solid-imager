import { Navigate, useLocation } from "@tanstack/solid-router";

const ROUTER_ORIGIN = "http://solid-imager.invalid";

function parseHref(href: string): URL {
	return new URL(href, ROUTER_ORIGIN);
}

export function toCanonicalSearchHref(href: string): string {
	const url = parseHref(href);
	return `/search${url.search}${url.hash}`;
}

export function toCanonicalV2Href(href: string): string {
	const url = parseHref(href);
	const canonicalPath =
		url.pathname === "/v2" || url.pathname === "/v2/"
			? "/search"
			: url.pathname.replace(/^\/v2(?=\/|$)/, "") || "/search";
	return `${canonicalPath}${url.search}${url.hash}`;
}

export function V2CompatibilityRedirect() {
	const location = useLocation();
	return <Navigate href={toCanonicalV2Href(location().href)} replace />;
}

export function SearchCompatibilityRedirect() {
	const location = useLocation();
	return <Navigate href={toCanonicalSearchHref(location().href)} replace />;
}
