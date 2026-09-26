import { createFileRoute } from "@tanstack/solid-router";
import { NotFoundRoute } from "~/components/not-found";

export const Route = createFileRoute("/$")({
	component: NotFoundRoute,
});
