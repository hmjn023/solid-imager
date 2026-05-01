import { buildMediaDetailsQueryOptions } from "@solid-imager/ui/query-options/media-query";
import { fetchMediaDetails } from "../media-api";

export const mediaDetailsQueryOptions = (mediaSourceId: string, mediaId: string) =>
	buildMediaDetailsQueryOptions(mediaSourceId, mediaId, fetchMediaDetails);
