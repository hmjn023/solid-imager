import { toCanonicalRouteHref } from "@solid-imager/ui/route-compat";
import { NotFoundScreen } from "@solid-imager/ui/screens/not-found-screen";
import { createFileRoute, Navigate, useLocation } from "@tanstack/solid-router";
import { Show } from "solid-js";

export const Route = createFileRoute("/$")({
	component: RouteCompatibilityFallback,
});

function RouteCompatibilityFallback() {
	const location = useLocation();
	const canonicalHref = () => toCanonicalRouteHref(location().href);
	return (
		<Show fallback={<NotFoundScreen />} when={canonicalHref()}>
			{(href) => <Navigate to={href()} replace />}
		</Show>
	);
}
