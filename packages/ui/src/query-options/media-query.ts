import type {
	MediaDetails,
	RelatedMediaResponse,
} from "@solid-imager/core/media";
import type { UUID } from "@solid-imager/core/shared";
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

export const relatedMediaQueryKeys = {
	detail: (sourceId: UUID, mediaId: UUID) =>
		["relatedMedia", sourceId, mediaId] as const,
	list: (sourceId: UUID, mediaId: UUID, limit: number, seed = "default") =>
		[...relatedMediaQueryKeys.detail(sourceId, mediaId), limit, seed] as const,
};

export function buildRelatedMediaQueryOptions(
	sourceId: UUID,
	mediaId: UUID,
	limit: number,
	seed: string,
	queryFn: (
		sourceId: UUID,
		mediaId: UUID,
		limit: number,
		seed: string,
		signal: AbortSignal,
	) => Promise<RelatedMediaResponse>,
) {
	return {
		queryKey: relatedMediaQueryKeys.list(sourceId, mediaId, limit, seed),
		queryFn: ({ signal }: QueryFunctionContext) =>
			queryFn(sourceId, mediaId, limit, seed, signal),
		staleTime: 60_000,
	};
}
