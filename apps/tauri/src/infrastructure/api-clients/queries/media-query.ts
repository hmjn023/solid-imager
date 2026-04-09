import { queryOptions } from "@tanstack/solid-query";
import { fetchMediaDetails } from "../media-api";

export const mediaDetailsQueryOptions = (
	mediaSourceId: string,
	mediaId: string,
) =>
	queryOptions({
		queryKey: ["mediaDetails", mediaSourceId, mediaId],
		queryFn: () => fetchMediaDetails(mediaSourceId, mediaId),
	});
