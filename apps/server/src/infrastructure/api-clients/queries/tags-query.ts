import { queryOptions } from "@tanstack/solid-query";
import { fetchTags } from "../tags-api";

export const tagsQueryOptions = () =>
	queryOptions({
		queryKey: ["tags"],
		queryFn: fetchTags,
	});
