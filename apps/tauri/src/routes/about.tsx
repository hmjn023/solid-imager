import { AboutScreen } from "@solid-imager/ui/screens/about-screen";
import { createFileRoute } from "@tanstack/solid-router";
import { getApiDocsUrl } from "~/infrastructure/settings/server-settings";

export const Route = createFileRoute("/about")({
	component: AboutRoute,
});

function AboutRoute() {
	return <AboutScreen docsHref={getApiDocsUrl()} />;
}
