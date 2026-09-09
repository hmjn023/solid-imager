import { createFileRoute } from "@tanstack/solid-router";
import { ConfigPage } from "~/components/pages/config-page";

export const Route = createFileRoute("/config")({
	ssr: false,
	pendingComponent: () => null,
	component: ConfigPage,
});
