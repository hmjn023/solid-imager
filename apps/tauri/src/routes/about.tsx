import { AboutScreen } from "@solid-imager/ui/screens/about-screen";
import { createFileRoute } from "@tanstack/solid-router";
import { getApiBaseUrl } from "~/infrastructure/api-base";

export const Route = createFileRoute("/about")({
	component: AboutRoute,
});

function AboutRoute() {
	return <AboutScreen docsHref={`${getApiBaseUrl()}/docs/scalar`} />;
}
