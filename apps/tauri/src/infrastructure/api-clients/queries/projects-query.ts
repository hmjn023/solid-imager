import { buildProjectsQueryOptions } from "@solid-imager/ui/query-options/projects-query";
import { fetchAllProjects } from "../projects-api";

export const allProjectsQueryOptions = () => buildProjectsQueryOptions(fetchAllProjects);
