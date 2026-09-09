import { createFileRoute } from "@tanstack/solid-router";
import { V2ConfigPage } from "~/components/v2/v2-config-page";

export const Route = createFileRoute("/config")({
	ssr: false,
	pendingComponent: () => null,
	component: V2ConfigPage,
});
