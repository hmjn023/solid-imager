import { buildAuthorsQueryOptions } from "@solid-imager/ui/query-options/authors-query";
import { fetchAllAuthors } from "../authors-api";

export const allAuthorsQueryOptions = () =>
	buildAuthorsQueryOptions(fetchAllAuthors);
