import { createFileRoute } from "@tanstack/solid-router";
import { AboutPage } from "~/components/pages/about-page";

export const Route = createFileRoute("/about")({
	component: AboutPage,
});
