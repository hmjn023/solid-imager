import { NotFoundScreen } from "@solid-imager/ui/screens/not-found-screen";
import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/$")({
	component: NotFoundScreen,
});
