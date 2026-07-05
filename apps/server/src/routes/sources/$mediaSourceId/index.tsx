import { prefetchQueryOnClient } from "@solid-imager/ui/query-options";
import { createFileRoute } from "@tanstack/solid-router";
import {
	allAuthorsQueryOptions,
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	tagsQueryOptions,
} from "~/infrastructure/api-clients/queries";
import { SourceMediaPage } from "./components/source-media-page";

export const Route = createFileRoute("/sources/$mediaSourceId/")({
	loader: ({ context }) => {
		prefetchQueryOnClient(() =>
			context.queryClient.prefetchQuery(tagsQueryOptions()),
		);
		prefetchQueryOnClient(() =>
			context.queryClient.prefetchQuery(allProjectsQueryOptions()),
		);
		prefetchQueryOnClient(() =>
			context.queryClient.prefetchQuery(allIpsQueryOptions()),
		);
		prefetchQueryOnClient(() =>
			context.queryClient.prefetchQuery(allCharactersQueryOptions()),
		);
		prefetchQueryOnClient(() =>
			context.queryClient.prefetchQuery(allAuthorsQueryOptions()),
		);
	},
	component: SourceMediaPage,
});
