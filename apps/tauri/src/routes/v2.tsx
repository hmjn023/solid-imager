import {
	createFileRoute,
	Navigate,
	Outlet,
	useLocation,
} from "@tanstack/solid-router";
import { Show } from "solid-js";

export const Route = createFileRoute("/v2")({
	component: V2AdapterLayout,
});

function V2AdapterLayout() {
	const location = useLocation();

	return (
		<Show
			fallback={<Navigate replace to="/search" />}
			when={location().pathname !== "/v2"}
		>
			<Outlet />
		</Show>
	);
}
