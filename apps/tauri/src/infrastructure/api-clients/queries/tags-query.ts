import { buildTagsQueryOptions } from "@solid-imager/ui/query-options/tags-query";
import { fetchTags } from "../tags-api";

export const tagsQueryOptions = () => buildTagsQueryOptions(fetchTags);
