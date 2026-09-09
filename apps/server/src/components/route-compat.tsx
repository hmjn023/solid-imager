import { toCanonicalLegacyHref } from "@solid-imager/ui/route-compat";
import { Navigate, useLocation } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { NotFoundRoute } from "~/components/not-found";

export { toCanonicalLegacyHref } from "@solid-imager/ui/route-compat";

export function toCanonicalSearchHref(href: string): string {
	const url = new URL(href, "http://solid-imager.invalid");
	return `/search${url.search}${url.hash}`;
}

export function LegacyRouteRedirect() {
	const location = useLocation();
	const canonicalHref = () => toCanonicalLegacyHref(location().href);
	return (
		<Show fallback={<NotFoundRoute />} when={canonicalHref()}>
			{(href) => <Navigate to={href()} replace />}
		</Show>
	);
}

export function SearchCompatibilityRedirect() {
	const location = useLocation();
	return <Navigate to={toCanonicalSearchHref(location().href)} replace />;
}
