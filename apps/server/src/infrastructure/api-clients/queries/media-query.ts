import type { UUID } from "@solid-imager/core/domain/shared/schemas";
import { queryOptions } from "@tanstack/solid-query";
import { fetchMediaDetails } from "../media-api";

export const mediaDetailsQueryOptions = (mediaSourceId: UUID, mediaId: UUID) =>
	queryOptions({
		queryKey: ["mediaDetails", mediaSourceId, mediaId],
		queryFn: () => fetchMediaDetails(mediaSourceId, mediaId),
	});
