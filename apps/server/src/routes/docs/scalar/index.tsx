import { createFileRoute } from "@tanstack/solid-router";
import { ScalarApiReference } from "~/components/scalar-api-reference";

export const Route = createFileRoute("/docs/scalar/")({
	ssr: false,
	pendingComponent: () => null,
	component: ScalarApiReference,
});
