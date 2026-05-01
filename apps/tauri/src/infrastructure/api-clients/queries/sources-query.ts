import { buildSourcesQueryOptions } from "@solid-imager/ui/query-options/sources-query";
import { fetchMediaSources } from "../sources-api";

export const mediaSourcesQueryOptions = () => buildSourcesQueryOptions(fetchMediaSources);
