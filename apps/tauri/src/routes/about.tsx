import { createFileRoute, Link } from "@tanstack/solid-router";

export const Route = createFileRoute("/about")({
	component: AboutRoute,
});

function AboutRoute() {
	return (
		<main class="mx-auto max-w-3xl p-4 text-center text-gray-700">
			<h1 class="my-16 font-thin text-6xl text-sky-700 uppercase">
				About Page
			</h1>
			<p class="mt-8">
				This standalone desktop client is being migrated out of the SSR app
				boundary while keeping the same user-facing routes.
			</p>
			<p class="my-4">
				<Link class="text-sky-600 hover:underline" to="/">
					Home
				</Link>
				{" - "}
				<span>About Page</span>
			</p>
		</main>
	);
}
