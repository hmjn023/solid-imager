import { createFileRoute, Navigate } from "@tanstack/solid-router";

export const Route = createFileRoute("/")({
	component: () => <Navigate replace to="/search" />,
});
