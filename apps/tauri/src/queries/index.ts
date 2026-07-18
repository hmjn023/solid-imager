import { createORPCSolidQueryUtils } from "@orpc/solid-query";
import {
	authorsQueryKeys,
	charactersQueryKeys,
	configQueryKeys,
	defaultAuthorsQueryConfig,
	defaultCharactersQueryConfig,
	defaultConfigQueryConfig,
	defaultIpsQueryConfig,
	defaultMediaDetailsQueryConfig,
	defaultProjectsQueryConfig,
	defaultSourcesQueryConfig,
	defaultTagsQueryConfig,
	ipsQueryKeys,
	mediaDetailsQueryKeys,
	projectsQueryKeys,
	sourcesQueryKeys,
	tagsQueryKeys,
} from "@solid-imager/ui/query-options";
import { client } from "~/orpc-client";

const utils = createORPCSolidQueryUtils(client);

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
