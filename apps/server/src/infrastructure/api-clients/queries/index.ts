import { createORPCSolidQueryUtils } from "@orpc/solid-query";
import { orpc } from "../orpc-client";

const utils = createORPCSolidQueryUtils(orpc);

export const tagsQueryOptions = utils.tags.list.queryOptions;
export const mediaSourcesQueryOptions = utils.sources.list.queryOptions;
export const allProjectsQueryOptions = utils.projects.list.queryOptions;
export const allCharactersQueryOptions = utils.characters.list.queryOptions;
export const allIpsQueryOptions = utils.ips.list.queryOptions;
export const allAuthorsQueryOptions = utils.authors.list.queryOptions;
export const configQueryOptions = utils.config.get.queryOptions;
export const mediaDetailsQueryOptions = (
	mediaSourceId: string,
	mediaId: string,
) =>
	utils.media.getDetails.queryOptions({
		input: { sourceId: mediaSourceId, mediaId },
	});
export const projectsForMediaQueryOptions = (
	mediaSourceIdOrMediaId: string,
	mediaId?: string,
) =>
	utils.projects.listForMedia.queryOptions({
		input: { mediaId: mediaId ?? mediaSourceIdOrMediaId },
	});
