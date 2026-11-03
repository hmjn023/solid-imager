import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import type { UUID } from "@solid-imager/core/domain/shared/schemas";
import type { QueryFunctionContext } from "@tanstack/solid-query";

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
	queryFn: (
		sourceId: UUID,
		id: UUID,
		signal: AbortSignal,
	) => Promise<MediaDetails>,
) {
	return {
		queryKey: mediaDetailsQueryKeys.detail(mediaSourceId, mediaId),
		queryFn: ({ signal }: QueryFunctionContext) =>
			queryFn(mediaSourceId, mediaId, signal),
		...defaultMediaDetailsQueryConfig,
	};
}
