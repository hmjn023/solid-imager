import type { AppContractClient } from "@solid-imager/core/contract";
import type { JobListRequest } from "@solid-imager/core/jobs";
import {
	buildAuthorsQueryOptions,
	buildCharactersQueryOptions,
	buildConfigQueryOptions,
	buildIpsQueryOptions,
	buildJobsQueryOptions,
	buildMediaDetailsQueryOptions,
	buildRelatedMediaQueryOptions,
	buildProjectsForMediaQueryOptions,
	buildProjectsQueryOptions,
	buildSourcesQueryOptions,
	buildTagsQueryOptions,
	defaultJobsQueryInput,
} from "./index";

/** Binds shared query option factories to an application contract client. */
export function createAppQueryOptions(client: AppContractClient) {
	return {
		tagsQueryOptions: () =>
			buildTagsQueryOptions(({ signal }) =>
				client.tags.list(undefined, { signal }),
			),
		mediaSourcesQueryOptions: () =>
			buildSourcesQueryOptions(({ signal }) =>
				client.sources.list(undefined, { signal }),
			),
		allProjectsQueryOptions: () =>
			buildProjectsQueryOptions(({ signal }) =>
				client.projects.list(undefined, { signal }),
			),
		allCharactersQueryOptions: () =>
			buildCharactersQueryOptions(({ signal }) =>
				client.characters.list(undefined, { signal }),
			),
		allIpsQueryOptions: () =>
			buildIpsQueryOptions(({ signal }) =>
				client.ips.list(undefined, { signal }),
			),
		allAuthorsQueryOptions: () =>
			buildAuthorsQueryOptions(({ signal }) =>
				client.authors.list(undefined, { signal }),
			),
		configQueryOptions: () =>
			buildConfigQueryOptions(({ signal }) =>
				client.config.get(undefined, { signal }),
			),
		jobsQueryOptions: (input: JobListRequest = defaultJobsQueryInput) =>
			buildJobsQueryOptions(input, (params, signal) =>
				client.jobs.list(params, { signal }),
			),
		mediaDetailsQueryOptions: (sourceId: string, mediaId: string) =>
			buildMediaDetailsQueryOptions(
				sourceId,
				mediaId,
				(sourceId, mediaId, signal) =>
					client.media.getDetails({ sourceId, mediaId }, { signal }),
			),
		relatedMediaQueryOptions: (
			sourceId: string,
			mediaId: string,
			seed = "default",
			limit = 12,
		) =>
			buildRelatedMediaQueryOptions(
				sourceId,
				mediaId,
				limit,
				seed,
				(sourceId, mediaId, limit, seed, signal) =>
					client.media.getRelated(
						{ sourceId, mediaId, limit, seed },
						{ signal },
					),
			),
		projectsForMediaQueryOptions: (
			sourceIdOrMediaId: string,
			mediaId = sourceIdOrMediaId,
		) =>
			buildProjectsForMediaQueryOptions(
				sourceIdOrMediaId,
				mediaId,
				(_sourceId, id, signal) =>
					client.projects.listForMedia({ mediaId: id }, { signal }),
			),
	};
}
