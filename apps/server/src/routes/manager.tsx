import { createFileRoute } from "@tanstack/solid-router";
import { ManagerPage } from "~/components/pages/manager-page";

export const Route = createFileRoute("/manager")({
	ssr: false,
	pendingComponent: () => null,
	component: ManagerPage,
});
