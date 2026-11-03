import { NotFoundScreen } from "@solid-imager/ui/screens/not-found";
import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/$")({
	component: NotFoundScreen,
});
