import type { Project } from "@solid-imager/core/domain/projects/schemas";
import { queryOptions } from "@tanstack/solid-query";

export const projectsQueryKeys = {
	all: () => ["allProjects"] as const,
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
