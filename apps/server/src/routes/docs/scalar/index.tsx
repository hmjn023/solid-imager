import { createFileRoute } from "@tanstack/solid-router";
import page from "~/infrastructure/api/scalar.html?raw";

export const Route = createFileRoute("/docs/scalar/")({
	server: {
		handlers: {
			GET: () =>
				new Response(page, {
					headers: { "content-type": "text/html; charset=utf-8" },
				}),
		},
	},
});
