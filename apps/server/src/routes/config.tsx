import { createFileRoute } from "@tanstack/solid-router";
import { V2ConfigPage } from "./v2/config";

export const Route = createFileRoute("/config")({
	component: V2ConfigPage,
});
