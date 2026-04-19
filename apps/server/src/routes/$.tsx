import { createFileRoute, Link } from "@tanstack/solid-router";

export const Route = createFileRoute("/$")({
	component: NotFound,
});

/**
 * A 404 Not Found page component.
 * Displays a message indicating the page was not found and provides links to the home and about pages.
 * @returns {JSX.Element} The rendered 404 page.
 */
function NotFound() {
	return (
		<main class="mx-auto p-4 text-center text-gray-700">
			<h1 class="max-6-xs my-16 font-thin text-6xl text-sky-700 uppercase">Not Found</h1>
			<p class="mt-8">
				Visit{" "}
				<a
					class="text-sky-600 hover:underline"
					href="https://solidjs.com"
					rel="noopener"
					target="_blank"
				>
					solidjs.com
				</a>{" "}
				to learn how to build Solid apps.
			</p>
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
