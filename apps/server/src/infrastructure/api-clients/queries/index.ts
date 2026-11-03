import { createAppQueryOptions } from "@solid-imager/ui/query";
import { orpc } from "../orpc-client";

export const {
	tagsQueryOptions,
	mediaSourcesQueryOptions,
	allProjectsQueryOptions,
	allCharactersQueryOptions,
	allIpsQueryOptions,
	jobsQueryOptions,
	allAuthorsQueryOptions,
	configQueryOptions,
	mediaDetailsQueryOptions,
	projectsForMediaQueryOptions,
} = createAppQueryOptions(orpc);
