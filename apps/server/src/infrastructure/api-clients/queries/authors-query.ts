import { queryOptions } from "@tanstack/solid-query";
import { fetchAllAuthors } from "../authors-api";

export const allAuthorsQueryOptions = () =>
	queryOptions({
		queryKey: ["allAuthors"] as const,
		queryFn: fetchAllAuthors,
	});
