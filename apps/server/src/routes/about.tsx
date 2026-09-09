import { createFileRoute } from "@tanstack/solid-router";
import { V2AboutPage } from "~/components/v2/v2-about-page";

export const Route = createFileRoute("/about")({
	ssr: false,
	pendingComponent: () => null,
	component: V2AboutPage,
});
