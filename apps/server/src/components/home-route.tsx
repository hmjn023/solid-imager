import { Navigate, useLocation } from "@tanstack/solid-router";

export function HomeRoute() {
	const location = useLocation();
	const searchHref = () => {
		const url = new URL(location().href, "http://solid-imager.invalid");
		return `/search${url.search}${url.hash}`;
	};
	return <Navigate to={searchHref()} replace />;
}
