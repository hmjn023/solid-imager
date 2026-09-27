import { searchHistoryQuerySchema } from "@solid-imager/ui/search-history-route";
import { createFileRoute } from "@tanstack/solid-router";
import {
	allAuthorsQueryOptions,
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	mediaSourcesQueryOptions,
	tagsQueryOptions,
} from "~/queries";
import { SourceMediaPage } from "./components/-source-media-page";

export const Route = createFileRoute("/sources/$mediaSourceId/")({
	validateSearch: searchHistoryQuerySchema,
	loader: ({ context }) => {
		void context.queryClient.query(tagsQueryOptions()).then(
			() => undefined,
			() => undefined,
		);
		void context.queryClient.query(allProjectsQueryOptions()).then(
			() => undefined,
			() => undefined,
		);
		void context.queryClient.query(allIpsQueryOptions()).then(
			() => undefined,
			() => undefined,
		);
		void context.queryClient.query(allCharactersQueryOptions()).then(
			() => undefined,
			() => undefined,
		);
		void context.queryClient.query(allAuthorsQueryOptions()).then(
			() => undefined,
			() => undefined,
		);
		void context.queryClient.query(mediaSourcesQueryOptions()).then(
			() => undefined,
			() => undefined,
		);
	},
	component: SourceMediaPage,
});
