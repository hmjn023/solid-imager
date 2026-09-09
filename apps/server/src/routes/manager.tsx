import { createFileRoute } from "@tanstack/solid-router";
import { V2ManagerPage } from "~/components/v2/v2-manager-page";

export const Route = createFileRoute("/manager")({
	ssr: false,
	pendingComponent: () => null,
	component: V2ManagerPage,
});
