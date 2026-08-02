import { createFileRoute, Navigate } from "@tanstack/solid-router";

export const Route = createFileRoute("/v2/")({
	component: V2Index,
});

function V2Index() {
	return <Navigate replace to="/v2/search" />;
}
