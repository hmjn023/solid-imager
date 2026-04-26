import { createFileRoute, Link } from "@tanstack/solid-router";

export const Route = createFileRoute("/$")({
	component: NotFoundRoute,
});

function NotFoundRoute() {
	return (
		<main class="mx-auto max-w-3xl p-4 text-center text-gray-700">
			<h1 class="my-16 font-thin text-6xl text-sky-700 uppercase">Not Found</h1>
			<p class="mt-8">The requested page has not been defined in the standalone Tauri SPA yet.</p>
			<p class="my-4">
				<Link class="text-sky-600 hover:underline" to="/">
					Home
				</Link>
				{" - "}
				<Link class="text-sky-600 hover:underline" to="/about">
					About Page
				</Link>
			</p>
		</main>
	);
}
