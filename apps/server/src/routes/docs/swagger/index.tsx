import { createFileRoute, redirect } from "@tanstack/solid-router";

export const Route = createFileRoute("/docs/swagger/")({
	beforeLoad: () => {
		throw redirect({ to: "/docs/scalar" });
	},
});
