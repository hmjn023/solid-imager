import type { Project } from "@solid-imager/core/domain/projects/schemas";
import type { QueryFunctionContext } from "@tanstack/solid-query";

export const projectsQueryKeys = {
	all: () => ["allProjects"] as const,
	forMedia: (mediaId: string) => ["projectsForMedia", mediaId] as const,
};

export const defaultProjectsQueryConfig = {
	staleTime: 1000 * 60 * 5,
};

export function buildProjectsQueryOptions(
	queryFn: (context: QueryFunctionContext) => Promise<Project[]>,
) {
	return {
		queryKey: projectsQueryKeys.all(),
		queryFn,
		...defaultProjectsQueryConfig,
	};
}

export function buildProjectsForMediaQueryOptions(
	mediaSourceId: string,
	mediaId: string,
	queryFn: (
		mediaSourceId: string,
		mediaId: string,
		signal: AbortSignal,
	) => Promise<Project[]>,
) {
	return {
		queryKey: projectsQueryKeys.forMedia(mediaId),
		queryFn: ({ signal }: QueryFunctionContext) =>
			queryFn(mediaSourceId, mediaId, signal),
		...defaultProjectsQueryConfig,
	};
}
