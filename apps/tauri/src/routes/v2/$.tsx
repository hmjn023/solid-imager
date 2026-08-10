import { NotFoundScreen } from "@solid-imager/ui/screens/not-found-screen";
import { createFileRoute, Navigate, useLocation } from "@tanstack/solid-router";
import { Match, Switch } from "solid-js";

export const Route = createFileRoute("/v2/$")({
	component: V2RouteAdapter,
});

function V2RouteAdapter() {
	const location = useLocation();
	const segments = () =>
		location()
			.pathname.replace(/^\/v2\/?/, "")
			.split("/")
			.filter(Boolean)
			.map((segment) => decodeURIComponent(segment));
	const first = () => segments()[0];

	return (
		<Switch fallback={<NotFoundScreen />}>
			<Match when={first() === "search"}>
				<Navigate replace to="/search" />
			</Match>
			<Match when={first() === "manager"}>
				<Navigate replace to="/manager" />
			</Match>
			<Match when={first() === "config"}>
				<Navigate replace to="/config" />
			</Match>
			<Match when={first() === "about"}>
				<Navigate replace to="/about" />
			</Match>
			<Match when={first() === "sources" && segments().length === 1}>
				<Navigate replace to="/sources" />
			</Match>
			<Match when={first() === "sources" && segments().length === 2}>
				<Navigate
					params={{ mediaSourceId: segments()[1] ?? "" }}
					replace
					to="/sources/$mediaSourceId"
				/>
			</Match>
			<Match when={first() === "sources" && segments().length >= 3}>
				<Navigate
					params={{
						mediaId: segments()[2] ?? "",
						mediaSourceId: segments()[1] ?? "",
					}}
					replace
					to="/sources/$mediaSourceId/$mediaId"
				/>
			</Match>
		</Switch>
	);
}
