import { createFileRoute, Outlet } from "@tanstack/solid-router";

export const Route = createFileRoute("/v2")({
	component: () => <Outlet />,
});
