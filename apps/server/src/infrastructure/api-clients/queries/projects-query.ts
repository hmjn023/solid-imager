import { queryOptions } from "@tanstack/solid-query";
import { fetchAllProjects } from "../projects-api";

export const allProjectsQueryOptions = () =>
	queryOptions({
		queryKey: ["allProjects"] as const,
		queryFn: fetchAllProjects,
	});
