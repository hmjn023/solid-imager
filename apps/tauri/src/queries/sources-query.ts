import { queryOptions } from "@tanstack/solid-query";
import { fetchMediaSources } from "~/api/sources-api";

export const mediaSourcesQueryOptions = () =>
	queryOptions({
		queryKey: ["mediaSources"],
		queryFn: fetchMediaSources,
	});
