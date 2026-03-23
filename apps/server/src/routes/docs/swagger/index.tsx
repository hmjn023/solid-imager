import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('docs/swagger')({
  component: RouteComponent,
})

import { clientOnly } from "@solidjs/start";

const SwaggerUi = clientOnly(() => import("~/components/swagger-ui"));

function RouteComponent() {
	return (
		<div class="container mx-auto p-4">
			<h1 class="mb-4 font-bold text-2xl">API Documentation</h1>
			<SwaggerUi />
		</div>
	);
}
