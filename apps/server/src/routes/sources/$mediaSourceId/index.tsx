import { createFileRoute } from "@tanstack/solid-router";
import { SourceMediaPage } from "./components/source-media-page";

export const Route = createFileRoute("/sources/$mediaSourceId/")({
	component: SourceMediaPage,
});
