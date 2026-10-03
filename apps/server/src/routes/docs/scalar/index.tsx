import { createFileRoute, lazyRouteComponent } from "@tanstack/solid-router";

const ScalarApiReference = lazyRouteComponent(
	() => import("~/components/scalar-api-reference"),
	"ScalarApiReference",
);

export const Route = createFileRoute("/docs/scalar/")({
	component: ScalarPage,
});

function ScalarPage() {
	return <ScalarApiReference />;
}
