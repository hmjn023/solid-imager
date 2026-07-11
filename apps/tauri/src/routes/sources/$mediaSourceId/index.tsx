import { createFileRoute } from "@tanstack/solid-router";
import {
	allAuthorsQueryOptions,
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	mediaSourcesQueryOptions,
	tagsQueryOptions,
} from "~/queries";
import { SourceMediaPage } from "./components/source-media-page";

export const Route = createFileRoute("/sources/$mediaSourceId/")({
	loader: ({ context }) => {
		void context.queryClient.prefetchQuery(tagsQueryOptions());
		void context.queryClient.prefetchQuery(allProjectsQueryOptions());
		void context.queryClient.prefetchQuery(allIpsQueryOptions());
		void context.queryClient.prefetchQuery(allCharactersQueryOptions());
		void context.queryClient.prefetchQuery(allAuthorsQueryOptions());
		void context.queryClient.prefetchQuery(mediaSourcesQueryOptions());
	},
	component: SourceMediaPage,
});
