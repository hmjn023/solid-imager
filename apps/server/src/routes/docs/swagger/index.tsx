import { createFileRoute, lazyRouteComponent } from "@tanstack/solid-router";

const SwaggerUi = lazyRouteComponent(() => import("~/components/swagger-ui"));

export const Route = createFileRoute("/docs/swagger/")({
	component: SwaggerPage,
});

function SwaggerPage() {
	return (
		<div class="container mx-auto p-4">
			<h1 class="mb-4 font-bold text-2xl">API Documentation</h1>
			<SwaggerUi />
		</div>
	);
}
