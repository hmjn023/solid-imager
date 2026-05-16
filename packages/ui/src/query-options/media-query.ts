import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import type { UUID } from "@solid-imager/core/domain/shared/schemas";
import { queryOptions } from "@tanstack/solid-query";

export const mediaDetailsQueryKeys = {
	detail: (mediaSourceId: UUID, mediaId: UUID) =>
		["mediaDetails", mediaSourceId, mediaId] as const,
};

export const defaultMediaDetailsQueryConfig = {
	staleTime: 1000 * 60 * 5,
};

export function buildMediaDetailsQueryOptions(
	mediaSourceId: UUID,
	mediaId: UUID,
	queryFn: (sourceId: UUID, id: UUID) => Promise<MediaDetails>,
) {
	return queryOptions({
		queryKey: mediaDetailsQueryKeys.detail(mediaSourceId, mediaId),
		queryFn: () => queryFn(mediaSourceId, mediaId),
		...defaultMediaDetailsQueryConfig,
	});
}
