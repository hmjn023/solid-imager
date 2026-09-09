import { createFileRoute } from "@tanstack/solid-router";
import { AboutPage } from "~/components/pages/about-page";

export const Route = createFileRoute("/about")({
	ssr: false,
	pendingComponent: () => null,
	component: AboutPage,
});
