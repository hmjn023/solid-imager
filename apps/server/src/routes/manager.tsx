import { createFileRoute } from "@tanstack/solid-router";
import { V2ManagerRoute } from "./v2/manager";

export const Route = createFileRoute("/manager")({
	component: V2ManagerRoute,
});
