import { queryOptions } from "@tanstack/solid-query";
import { fetchMediaDetails } from "~/api/media-api";

export const mediaDetailsQueryOptions = (sourceId: string, mediaId: string) =>
	queryOptions({
		queryKey: ["mediaDetails", sourceId, mediaId] as const,
		queryFn: () => fetchMediaDetails(sourceId, mediaId),
	});
