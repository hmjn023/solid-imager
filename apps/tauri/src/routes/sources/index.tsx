import { createFileRoute, Navigate, useLocation } from "@tanstack/solid-router";

export const Route = createFileRoute("/sources/")({
	component: SourcesRoute,
});

function SourcesRoute() {
	const location = useLocation();
	const searchHref = () => {
		const url = new URL(location().href, "http://solid-imager.invalid");
		return `/search${url.search}${url.hash}`;
	};
	return <Navigate replace to={searchHref()} />;
}
