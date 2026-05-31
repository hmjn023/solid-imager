import { queryOptions } from "@tanstack/solid-query";
import { fetchMediaDetails } from "~/api/media-api";

export const mediaDetailsQueryOptions = (sourceId: string, mediaId: string) =>
	queryOptions({
		queryKey: ["mediaDetails", sourceId, mediaId],
		queryFn: () => fetchMediaDetails(sourceId, mediaId),
	});
