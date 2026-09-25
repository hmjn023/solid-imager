import { createFileRoute } from "@tanstack/solid-router";
import { HomeRoute } from "~/components/home-route";

export const Route = createFileRoute("/")({
	component: HomeRoute,
});
