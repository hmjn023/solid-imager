import { queryOptions } from "@tanstack/solid-query";
import { fetchConfig } from "~/api/config-api";

export const configQueryOptions = () =>
	queryOptions({
		queryKey: ["config"] as const,
		queryFn: fetchConfig,
	});
