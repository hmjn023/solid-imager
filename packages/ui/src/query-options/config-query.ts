import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { queryOptions } from "@tanstack/solid-query";

export const configQueryKeys = {
	all: () => ["config"] as const,
};

export const defaultConfigQueryConfig = {
	staleTime: 1000 * 60 * 5,
};

export function buildConfigQueryOptions(queryFn: () => Promise<AppConfig>) {
	return queryOptions({
		queryKey: configQueryKeys.all(),
		queryFn,
		...defaultConfigQueryConfig,
	});
}
