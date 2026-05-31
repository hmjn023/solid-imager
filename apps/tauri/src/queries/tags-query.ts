import { queryOptions } from "@tanstack/solid-query";
import { fetchTags } from "~/api/tags-api";

export const tagsQueryOptions = () =>
	queryOptions({
		queryKey: ["tags"],
		queryFn: fetchTags,
	});
