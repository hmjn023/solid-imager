import { queryOptions } from "@tanstack/solid-query";
import { fetchAllProjects } from "../projects-api";

export const allProjectsQueryOptions = () =>
	queryOptions({
		queryKey: ["allProjects"],
		queryFn: fetchAllProjects,
	});
