import { createORPCSolidQueryUtils } from "@orpc/solid-query";
import type { JobListRequest } from "@solid-imager/core/domain/jobs/schemas";
import {
	authorsQueryKeys,
	charactersQueryKeys,
	configQueryKeys,
	defaultAuthorsQueryConfig,
	defaultCharactersQueryConfig,
	defaultConfigQueryConfig,
	defaultIpsQueryConfig,
	defaultJobsQueryConfig,
	defaultJobsQueryInput,
	defaultMediaDetailsQueryConfig,
	defaultProjectsQueryConfig,
	defaultSourcesQueryConfig,
	defaultTagsQueryConfig,
	ipsQueryKeys,
	jobsQueryKeys,
	mediaDetailsQueryKeys,
	projectsQueryKeys,
	sourcesQueryKeys,
	tagsQueryKeys,
} from "@solid-imager/ui/query-options";
import { orpc } from "../orpc-client";

const utils = createORPCSolidQueryUtils(orpc);

export const tagsQueryOptions = () => ({
	...utils.tags.list.queryOptions(),
	queryKey: tagsQueryKeys.all(),
	...defaultTagsQueryConfig,
});
export const mediaSourcesQueryOptions = () => ({
	...utils.sources.list.queryOptions(),
	queryKey: sourcesQueryKeys.all(),
	...defaultSourcesQueryConfig,
});
export const allProjectsQueryOptions = () => ({
	...utils.projects.list.queryOptions(),
	queryKey: projectsQueryKeys.all(),
	...defaultProjectsQueryConfig,
});
export const allCharactersQueryOptions = () => ({
	...utils.characters.list.queryOptions(),
	queryKey: charactersQueryKeys.all(),
	...defaultCharactersQueryConfig,
});
export const allIpsQueryOptions = () => ({
	...utils.ips.list.queryOptions(),
	queryKey: ipsQueryKeys.all(),
	...defaultIpsQueryConfig,
});
export const jobsQueryOptions = (
	input: JobListRequest = defaultJobsQueryInput,
) => ({
	...utils.jobs.list.queryOptions({ input }),
	queryKey: jobsQueryKeys.list(input),
	...defaultJobsQueryConfig,
});
export const allAuthorsQueryOptions = () => ({
	...utils.authors.list.queryOptions(),
	queryKey: authorsQueryKeys.all(),
	...defaultAuthorsQueryConfig,
});
export const configQueryOptions = () => ({
	...utils.config.get.queryOptions(),
	queryKey: configQueryKeys.all(),
	...defaultConfigQueryConfig,
});
export const mediaDetailsQueryOptions = (
	mediaSourceId: string,
	mediaId: string,
) => ({
	...utils.media.getDetails.queryOptions({
		input: { sourceId: mediaSourceId, mediaId },
	}),
	queryKey: mediaDetailsQueryKeys.detail(mediaSourceId, mediaId),
	...defaultMediaDetailsQueryConfig,
});
export const projectsForMediaQueryOptions = (
	mediaSourceIdOrMediaId: string,
	mediaId?: string,
) => ({
	...utils.projects.listForMedia.queryOptions({
		input: { mediaId: mediaId ?? mediaSourceIdOrMediaId },
	}),
	queryKey: projectsQueryKeys.forMedia(mediaId ?? mediaSourceIdOrMediaId),
	...defaultProjectsQueryConfig,
});
