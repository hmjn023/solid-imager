import {
	buildProjectsForMediaQueryOptions,
	buildProjectsQueryOptions,
} from "@solid-imager/ui/query-options/projects-query";
import { fetchAllProjects, fetchProjectsForMedia } from "../projects-api";

export const allProjectsQueryOptions = () =>
	buildProjectsQueryOptions(fetchAllProjects);

export const projectsForMediaQueryOptions = (
	mediaSourceId: string,
	mediaId: string,
) =>
	buildProjectsForMediaQueryOptions(
		mediaSourceId,
		mediaId,
		fetchProjectsForMedia,
	);
