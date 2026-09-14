import { toCanonicalLegacyHref } from "@solid-imager/ui/route-compat";
import { NotFoundScreen } from "@solid-imager/ui/screens/not-found-screen";
import { createFileRoute, Navigate, useLocation } from "@tanstack/solid-router";
import { Show } from "solid-js";

export const Route = createFileRoute("/$")({
	component: LegacyRouteFallback,
});

function LegacyRouteFallback() {
	const location = useLocation();
	const canonicalHref = () => toCanonicalLegacyHref(location().href);
	return (
		<Show fallback={<NotFoundScreen />} when={canonicalHref()}>
			{(href) => <Navigate to={href()} replace />}
		</Show>
	);
}
