import { createFileRoute, redirect } from "@tanstack/solid-router";

export const Route = createFileRoute("/")({
	beforeLoad: ({ location }: { location: { href: string } }) => {
		const url = new URL(location.href, "http://solid-imager.invalid");
		// oxlint-disable-next-line typescript/no-unsafe-call -- Oxlint resolves the registered TanStack router type as error here. The server TypeScript project checks the redirect.
		throw redirect({ href: `/search${url.search}${url.hash}`, replace: true });
	},
});
