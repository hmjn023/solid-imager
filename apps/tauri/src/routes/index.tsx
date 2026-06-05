import { Counter } from "@solid-imager/ui/counter";
import { createFileRoute, Link } from "@tanstack/solid-router";

export const Route = createFileRoute("/")({
	component: Home,
});

function Home() {
	return (
		<main class="mx-auto p-4 text-center text-gray-700">
			<h1 class="max-6-xs my-16 font-thin text-6xl text-sky-700 uppercase">
				Hello world!
			</h1>
			<Counter />
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
				<span>Home</span>
				{" - "}
				<Link class="text-sky-600 hover:underline" to="/about">
					About Page
				</Link>{" "}
			</p>
		</main>
	);
}
