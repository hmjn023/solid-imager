import type { Project } from "@solid-imager/core/domain/projects/schemas";
import { queryOptions } from "@tanstack/solid-query";

export const projectsQueryKeys = {
	all: () => ["allProjects"] as const,
	forMedia: (mediaId: string) => ["projectsForMedia", mediaId] as const,
};

export const defaultProjectsQueryConfig = {
	staleTime: 1000 * 60 * 5,
};

export function buildProjectsQueryOptions(queryFn: () => Promise<Project[]>) {
	return queryOptions({
		queryKey: projectsQueryKeys.all(),
		queryFn,
		...defaultProjectsQueryConfig,
	});
}

export function buildProjectsForMediaQueryOptions(
	mediaSourceId: string,
	mediaId: string,
	queryFn: (mediaSourceId: string, mediaId: string) => Promise<Project[]>,
) {
	return queryOptions({
		queryKey: projectsQueryKeys.forMedia(mediaId),
		queryFn: () => queryFn(mediaSourceId, mediaId),
		...defaultProjectsQueryConfig,
	});
}
